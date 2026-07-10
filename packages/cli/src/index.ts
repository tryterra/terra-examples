#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import {
  describeTemplates,
  listTemplates,
  scaffold,
  templateExists,
} from "./lib/copy.js";
import { runCommand } from "./lib/exec.js";
import { tryGitInit } from "./lib/git.js";
import { createReporter, EXIT, getReporter } from "./lib/output.js";
import {
  getUserPkgManager,
  installCommand,
  isPackageManager,
  PACKAGE_MANAGERS,
  type PackageManager,
  runScriptCommand,
} from "./lib/pkg-manager.js";
import { bail, confirmSetup, resolveTarget } from "./lib/prompts.js";
import { renderTitle } from "./lib/title.js";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(here, "..", "package.json"), "utf-8"),
) as { version: string };

const HELP = `
  create-tryterra-app - scaffold a Terra example app

  Usage
    npx create-tryterra-app [directory] [options]

  Options
    --template <name>          Skip the picker and use this example
    --list                     List available examples (add --json for machine output)
    --package-manager <name>   Force npm | pnpm | yarn | bun (default: auto-detect)
    --yes, -y                  Non-interactive: accept defaults, never prompt
    --force                    Scaffold into a non-empty directory
    --setup                    Run the example's setup script after install
    --no-setup                 Never run the setup script
    --skip-install             Don't run the package install (alias: --no-install)
    --no-git                   Don't initialize a git repository
    --json                     Machine-readable output on stdout, logs on stderr
    -h, --help                 Show this help
    -v, --version              Show version

  Examples
    # Interactive (human): pick an example, name it, optionally deploy
    npx create-tryterra-app

    # Non-interactive one-liner (agents / CI)
    npx create-tryterra-app my-app --template unified-api-web-app --yes

    # Machine-readable result on stdout, progress on stderr
    npx create-tryterra-app my-app --template unified-api-web-app --json

    # Discover examples as JSON
    npx create-tryterra-app --list --json

  Exit codes
    0  success
    1  usage / input error (bad flag, unknown template, non-empty dir without --force)
    2  execution failure (install or setup command failed)

  AI agents: see AGENTS.md in the repo root for the full non-interactive workflow.
`;

/** A suggested follow-up command, with an optional human-facing description. */
interface NextStep {
  command: string;
  description?: string;
}

/** The machine-readable result emitted to stdout in `--json` mode. */
interface ScaffoldResult {
  ok: true;
  directory: string;
  path: string;
  template: string;
  packageManager: PackageManager;
  install: boolean;
  git: boolean;
  setup: boolean;
  nextSteps: string[];
}

/** Detects a CI environment so the CLI never blocks on prompts there. */
function isCI(): boolean {
  const e = process.env;
  if (e.CI && e.CI !== "false" && e.CI !== "0") return true;
  return Boolean(
    e.CONTINUOUS_INTEGRATION ||
      e.GITHUB_ACTIONS ||
      e.GITLAB_CI ||
      e.BUILDKITE ||
      e.CIRCLECI,
  );
}

async function run(): Promise<void> {
  let parsed;
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        template: { type: "string" },
        list: { type: "boolean" },
        "package-manager": { type: "string" },
        yes: { type: "boolean", short: "y" },
        force: { type: "boolean" },
        setup: { type: "boolean" },
        "no-setup": { type: "boolean" },
        "skip-install": { type: "boolean" },
        "no-install": { type: "boolean" },
        "no-git": { type: "boolean" },
        json: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message.split(".")[0] : String(e);
    bail(`${msg}. Run \`create-tryterra-app --help\` for usage.`);
  }
  const { values, positionals } = parsed;

  if (values.help) return void console.log(HELP);
  if (values.version) return void console.log(pkg.version);

  const reporter = createReporter(values.json ? "json" : "human");

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 20) {
    bail(`Node.js 20+ is required (you have ${process.versions.node}).`);
  }

  const templates = listTemplates();
  if (templates.length === 0) bail("No templates found in this package.");

  /* --------------------------------- List --------------------------------- */

  if (values.list) {
    const described = describeTemplates();
    if (reporter.json) {
      reporter.data({ templates: described });
    } else {
      renderTitle();
      for (const t of described) {
        const desc = t.description ? `  ${pc.dim(t.description)}` : "";
        console.log(`  ${pc.cyan(t.name)}${desc}`);
      }
    }
    return;
  }

  /* --------------------------- Interactivity mode ------------------------- */

  const interactive =
    Boolean(process.stdin.isTTY) && !values.yes && !values.json && !isCI();

  /* ---------------------------- Package manager --------------------------- */

  const pmFlag = values["package-manager"];
  let pkgManager = getUserPkgManager();
  if (pmFlag) {
    if (!isPackageManager(pmFlag)) {
      bail(
        `Unknown --package-manager "${pmFlag}". Use one of: ${PACKAGE_MANAGERS.join(", ")}.`,
      );
    }
    pkgManager = pmFlag;
  }

  /* ------------------------------- Preamble ------------------------------- */

  if (interactive) renderTitle();
  reporter.intro(pc.dim("Let's scaffold a Terra API example app."));

  // Fail fast on a bad --template flag, before any prompting.
  if (values.template && !templateExists(values.template)) {
    bail(
      `Unknown template "${values.template}". Available: ${templates.join(", ")}`,
    );
  }

  /* --------------------------- Name / template ---------------------------- */

  const { targetName, template } = await resolveTarget({
    interactive,
    nameArg: positionals[0],
    templateFlag: values.template,
    templates,
    force: values.force === true,
  });
  const targetDir = resolve(process.cwd(), targetName);

  /* ------------------------------- Scaffold ------------------------------- */

  const copy = reporter.task();
  copy.start(`Creating ${template}`);
  const appPkg = scaffold(template, targetDir);
  copy.stop(`Created ${targetName} from ${template}`);

  /* ------------------------------- Install -------------------------------- */

  const install = installCommand(pkgManager);
  const skipInstall =
    values["skip-install"] === true || values["no-install"] === true;
  if (!skipInstall) {
    const installing = reporter.task();
    installing.start(`Installing dependencies (${install})`);
    try {
      // Runs async (output hidden) so the spinner animates while it works;
      // captured stderr is surfaced only if the install fails.
      await runCommand(install, targetDir);
      installing.stop("Dependencies installed");
    } catch (e) {
      installing.stop("Dependency install failed");
      const details = e instanceof Error && "stderr" in e ? String(e.stderr) : "";
      if (details.trim()) reporter.error(details.trim());
      bail(
        `\`${install}\` failed. Check the errors above, then run it manually.`,
        EXIT.RUNTIME,
      );
    }
  }

  /* --------------------------------- Git ---------------------------------- */

  let ranGit = false;
  if (values["no-git"] !== true && tryGitInit(targetDir)) {
    ranGit = true;
    reporter.success("Initialized a git repository");
  }

  /* -------------------------------- Setup --------------------------------- */

  // Setup runs when it's available, install happened, and it wasn't opted out.
  // The `--setup` flag drives it in any mode; interactively we also offer it.
  const hasSetup = Boolean(appPkg.scripts?.setup);
  const setupEligible = hasSetup && !skipInstall && values["no-setup"] !== true;
  let ranSetup = false;
  if (setupEligible) {
    const wantSetup =
      values.setup === true || (interactive && (await confirmSetup()));
    if (wantSetup) {
      try {
        execSync(runScriptCommand(pkgManager, "setup"), {
          cwd: targetDir,
          // Human: inherit the wizard's TTY. json: no stdin (forces the setup
          // script's own non-interactive path) and its output to our stderr,
          // keeping stdout a clean JSON channel.
          stdio: reporter.json ? ["ignore", 2, 2] : "inherit",
        });
        ranSetup = true;
      } catch {
        bail(
          `\`${runScriptCommand(pkgManager, "setup")}\` failed. Check the errors above, then re-run it.`,
          EXIT.RUNTIME,
        );
      }
    }
  }

  /* --------------------------------- Done --------------------------------- */

  // Next-step commands: the plain `command`s are the JSON payload; the
  // descriptions are used only for the human "Next steps" note below.
  const nextSteps: NextStep[] = [
    ...(targetName === "." ? [] : [{ command: `cd ${targetName}` }]),
    ...(skipInstall ? [{ command: install }] : []),
    ...(hasSetup && !ranSetup
      ? [
          {
            command: runScriptCommand(pkgManager, "setup"),
            description: "set up services + deploy it live",
          },
        ]
      : []),
    {
      command: runScriptCommand(pkgManager, "dev"),
      description: "start the dev server",
    },
  ];

  const result: ScaffoldResult = {
    ok: true,
    directory: targetName,
    path: targetDir,
    template,
    packageManager: pkgManager,
    install: !skipInstall,
    git: ranGit,
    setup: ranSetup,
    nextSteps: nextSteps.map((s) => s.command),
  };
  reporter.data(result);

  // A "cmd    description" line: the command in cyan, padded to a column, with
  // a dimmed description beside it.
  const COMMAND_COLUMN = 22;
  const step = (command: string, description?: string): string => {
    if (!description) return pc.cyan(command);
    const gap = " ".repeat(Math.max(1, COMMAND_COLUMN - command.length));
    return `${pc.cyan(command)}${gap}${pc.dim(description)}`;
  };
  reporter.note(
    nextSteps.map((s) => step(s.command, s.description)).join("\n"),
    "Next steps",
  );

  reporter.outro("Done! Happy building with Terra.");
}

run().catch((e) => {
  getReporter().error(e instanceof Error ? e.message : String(e));
  process.exit(EXIT.RUNTIME);
});

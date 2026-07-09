#!/usr/bin/env node
import { intro, log, note, outro, spinner } from "@clack/prompts";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { listTemplates, scaffold, templateExists } from "./lib/copy.js";
import { runCommand } from "./lib/exec.js";
import { tryGitInit } from "./lib/git.js";
import {
  getUserPkgManager,
  installCommand,
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
    --template <name>   Skip the picker and use this example
    --skip-install      Don't run the package install
    --no-git            Don't initialize a git repository
    -h, --help          Show this help
    -v, --version       Show version
`;

async function run(): Promise<void> {
  let parsed;
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        template: { type: "string" },
        "skip-install": { type: "boolean" },
        "no-git": { type: "boolean" },
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

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 20) {
    bail(`Node.js 20+ is required (you have ${process.versions.node}).`);
  }

  const interactive = Boolean(process.stdin.isTTY);
  const pkgManager = getUserPkgManager();

  renderTitle();
  intro(pc.dim("Let's scaffold a Terra API example app."));

  const templates = listTemplates();
  if (templates.length === 0) bail("No templates found in this package.");

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
  });
  const targetDir = resolve(process.cwd(), targetName);

  /* ------------------------------- Scaffold ------------------------------- */

  const copy = spinner();
  copy.start(`Creating ${template}`);
  const appPkg = scaffold(template, targetDir);
  copy.stop(`Created ${targetName} from ${template}`);

  /* ------------------------------- Install -------------------------------- */

  const install = installCommand(pkgManager);
  const skipInstall = values["skip-install"] === true;
  if (!skipInstall) {
    const installing = spinner();
    installing.start(`Installing dependencies (${install})`);
    try {
      // Runs async (output hidden) so the spinner animates while it works;
      // captured stderr is surfaced only if the install fails.
      await runCommand(install, targetDir);
      installing.stop("Dependencies installed");
    } catch (e) {
      installing.stop("Dependency install failed");
      const details = e instanceof Error && "stderr" in e ? String(e.stderr) : "";
      if (details.trim()) log.error(details.trim());
      bail(`\`${install}\` failed. Check the errors above, then run it manually.`);
    }
  }

  /* --------------------------------- Git ---------------------------------- */

  if (values["no-git"] !== true && tryGitInit(targetDir)) {
    log.success("Initialized a git repository");
  }

  /* -------------------------------- Setup --------------------------------- */

  const hasSetup = Boolean(appPkg.scripts?.setup);
  let ranSetup = false;
  if (interactive && hasSetup && !skipInstall && (await confirmSetup())) {
    execSync(runScriptCommand(pkgManager, "setup"), {
      cwd: targetDir,
      stdio: "inherit",
    });
    ranSetup = true;
  }

  /* --------------------------------- Done --------------------------------- */

  // A "cmd    description" line: the command in cyan, padded to a column, with
  // a dimmed description beside it.
  const COMMAND_COLUMN = 22;
  const step = (command: string, description?: string): string => {
    if (!description) return pc.cyan(command);
    const gap = " ".repeat(Math.max(1, COMMAND_COLUMN - command.length));
    return `${pc.cyan(command)}${gap}${pc.dim(description)}`;
  };

  const steps = [
    ...(targetName === "." ? [] : [step(`cd ${targetName}`)]),
    ...(skipInstall ? [step(install)] : []),
    ...(hasSetup && !ranSetup
      ? [step(runScriptCommand(pkgManager, "setup"), "set up services + deploy it live")]
      : []),
    step(runScriptCommand(pkgManager, "dev"), "start the dev server"),
  ];
  note(steps.join("\n"), "Next steps");

  outro("Done! Happy building with Terra.");
}

run().catch((e) => {
  log.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

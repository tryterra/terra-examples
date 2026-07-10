import { confirm, group, isCancel, select, text } from "@clack/prompts";
import { basename, resolve } from "node:path";
import validateNpmName from "validate-npm-package-name";
import { isEmptyDir, templateDescription } from "./copy.js";
import { EXIT, getReporter } from "./output.js";

/** Prints an error (honoring json mode) and exits — usage error by default. */
export function bail(msg: string, code: number = EXIT.USAGE): never {
  getReporter().error(msg);
  process.exit(code);
}

/** Shared cancel handler for @clack prompts and prompt groups. */
function onCancel(): never {
  bail("Operation cancelled.");
}

/** `health-fitness-web-app` → `Health Fitness Web App` */
function prettify(name: string): string {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Validates a project name / target directory for a clack `text` prompt.
 * Returns an error string when invalid, `undefined` when OK. Mirrors
 * create-next-app: the directory's basename must be a legal npm package name.
 * `.` (scaffold into the current directory) is allowed.
 */
function validateProjectName(input: string | undefined): string | undefined {
  const value = (input ?? "").trim();
  // Empty falls back to the prompt's defaultValue; "." scaffolds into cwd.
  if (!value || value === ".") return undefined;

  const name = basename(value.replace(/[/\\]+$/, ""));
  const { validForNewPackages, errors, warnings } = validateNpmName(name);
  if (validForNewPackages) return undefined;

  const problem = errors?.[0] ?? warnings?.[0];
  return problem
    ? `Invalid name: ${problem}.`
    : "Name must be a valid npm package name (lowercase, no spaces).";
}

export interface TargetOptions {
  interactive: boolean;
  /** Positional directory argument, if the user passed one. */
  nameArg?: string;
  /** `--template` flag value, if passed (already validated by the caller). */
  templateFlag?: string;
  templates: string[];
  /** `--force`: allow scaffolding into a non-empty directory. */
  force: boolean;
}

export interface Target {
  targetName: string;
  template: string;
}

/**
 * Resolves the target directory and template. Interactively this is a single
 * template → name → overwrite prompt group (the project name defaults to the
 * chosen example). Non-interactively it applies the equivalent guards against
 * the CLI flags without prompting.
 */
export async function resolveTarget(opts: TargetOptions): Promise<Target> {
  const { interactive, nameArg, templateFlag, templates, force } = opts;

  if (!interactive) {
    if (!nameArg) {
      bail("Provide a target directory (positional argument), e.g. `my-app`.");
    }
    const template =
      templateFlag ?? (templates.length === 1 ? templates[0] : undefined);
    if (!template) {
      bail(`Pass --template <name>. Available: ${templates.join(", ")}`);
    }
    if (!force && !isEmptyDir(resolve(process.cwd(), nameArg))) {
      bail(
        `Directory "${nameArg}" already exists and is not empty. Pass --force to scaffold into it anyway.`,
      );
    }
    return { targetName: nameArg, template };
  }

  const answers = await group(
    {
      // Always show the picker (even for a single example) unless --template
      // was passed.
      template: () =>
        templateFlag
          ? Promise.resolve(templateFlag)
          : select({
              message: "Which example app would you like to use?",
              options: templates.map((t) => ({
                value: t,
                label: prettify(t),
                hint: templateDescription(t),
              })),
            }),
      name: ({ results }) =>
        nameArg
          ? Promise.resolve(nameArg)
          : text({
              message: "What is your project named?",
              placeholder: results.template as string,
              defaultValue: results.template as string,
              validate: validateProjectName,
            }),
      overwrite: ({ results }) => {
        const dir = resolve(process.cwd(), results.name as string);
        return force || isEmptyDir(dir)
          ? Promise.resolve(true)
          : confirm({
              message: `Directory "${results.name}" is not empty. Continue anyway?`,
              initialValue: false,
            });
      },
    },
    { onCancel },
  );

  if (!answers.overwrite) bail("Operation cancelled.");
  return {
    targetName: answers.name as string,
    template: answers.template as string,
  };
}

export async function confirmSetup(): Promise<boolean> {
  const res = await confirm({
    message:
      "Run setup now? (creates your cloud services, securely saves your keys, and deploys the app live)",
    initialValue: true,
  });
  if (isCancel(res)) onCancel();
  return res as boolean;
}

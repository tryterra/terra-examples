import { readFileSync } from "node:fs";
import { parseArgs, type ParseArgsConfig } from "node:util";
import { bail } from "./helpers";
import {
  createReporter,
  EXIT,
  isCI,
  setInteractive,
  type Reporter,
} from "./output";

type Options = NonNullable<ParseArgsConfig["options"]>;

/** Flags every script shares — names kept consistent with create-tryterra-app. */
export const COMMON_OPTIONS = {
  json: { type: "boolean" },
  yes: { type: "boolean", short: "y" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
} satisfies Options;

/** A parsed flag value — string for `type: "string"`, boolean otherwise. */
export type Flags = Record<string, string | boolean | undefined>;

/** Parses argv against COMMON_OPTIONS + `options`; bails (usage) on a bad flag. */
export function parseFlags(options: Options = {}): Flags {
  try {
    return parseArgs({
      args: process.argv.slice(2),
      allowPositionals: false,
      options: { ...COMMON_OPTIONS, ...options },
    }).values as Flags;
  } catch (e) {
    const msg = e instanceof Error ? e.message.split(".")[0] : String(e);
    bail(`${msg}. Run with --help for usage.`, EXIT.USAGE);
  }
}

/** This package's version, read from package.json (repo root). */
export function packageVersion(): string {
  const url = new URL("../../package.json", import.meta.url);
  return (JSON.parse(readFileSync(url, "utf-8")) as { version: string })
    .version;
}

export interface Script {
  flags: Flags;
  reporter: Reporter;
  interactive: boolean;
}

/** Shared entry boilerplate: reporter, flag parse, --help/--version, interactive decision. */
export function initScript(help: string, options: Options = {}): Script {
  const reporter = createReporter(
    process.argv.includes("--json") ? "json" : "human",
  );
  const flags = parseFlags(options);
  if (flags.help) {
    console.log(help);
    process.exit(EXIT.OK);
  }
  if (flags.version) {
    console.log(packageVersion());
    process.exit(EXIT.OK);
  }
  const interactive =
    Boolean(process.stdin.isTTY) && !flags.yes && !flags.json && !isCI();
  setInteractive(interactive);
  return { flags, reporter, interactive };
}

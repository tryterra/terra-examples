import {
  intro as clackIntro,
  log,
  note as clackNote,
  outro as clackOutro,
  spinner,
} from "@clack/prompts";

/** Documented exit codes: 0 success · 1 usage/input error · 2 execution failure. */
export const EXIT = {
  OK: 0,
  /** Bad flag, missing credentials, cancel — anything the caller must fix. */
  USAGE: 1,
  /** A provisioning/build/deploy command failed. */
  RUNTIME: 2,
} as const;

export type OutputMode = "human" | "json";

/** A start/stop pair — a spinner for humans, plain stderr lines for agents. */
export interface Task {
  start(message?: string): void;
  stop(message?: string): void;
}

export interface Reporter {
  mode: OutputMode;
  /** True in machine-readable mode (stdout is a clean JSON channel). */
  json: boolean;
  intro(message: string): void;
  outro(message: string): void;
  note(body: string, title?: string): void;
  message(body: string): void;
  step(message: string): void;
  success(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  /** A spinner (human) or plain stderr lines (json), mirroring @clack's `spinner()`. */
  task(): Task;
  /** Raw child-command output — printed for humans, suppressed in json mode. */
  passthrough(text: string): void;
  /** The ONLY writer to stdout — emits one JSON line (json mode) or nothing. */
  data(obj: unknown): void;
}

let active: Reporter | null = null;

/** The active reporter (or a human default) so `bail` can honor json mode. */
export function getReporter(): Reporter {
  return active ?? createReporter("human");
}

/** Writes a line to stderr, skipping empties. Agent-mode progress channel. */
function toStderr(message: string): void {
  if (message) console.error(message);
}

/** Human mode routes through @clack; json mode keeps stdout for a single `data()` payload and sends all progress to stderr. */
export function createReporter(mode: OutputMode): Reporter {
  const json = mode === "json";
  const reporter: Reporter = {
    mode,
    json,
    intro: (m) => (json ? toStderr(m) : clackIntro(m)),
    outro: (m) => (json ? toStderr(m) : clackOutro(m)),
    note: (body, title) => {
      if (!json) clackNote(body, title);
    },
    message: (m) => (json ? toStderr(m) : log.message(m)),
    step: (m) => (json ? toStderr(m) : log.step(m)),
    success: (m) => (json ? toStderr(m) : log.success(m)),
    info: (m) => (json ? toStderr(m) : log.info(m)),
    warn: (m) => (json ? toStderr(m) : log.warn(m)),
    error: (m) => (json ? toStderr(m) : log.error(m)),
    task: () => {
      if (json) {
        return {
          start: (m) => toStderr(m ?? ""),
          stop: (m) => toStderr(m ?? ""),
        };
      }
      const s = spinner();
      return { start: (m) => s.start(m), stop: (m) => s.stop(m) };
    },
    passthrough: (text) => {
      if (!json) process.stdout.write(text);
    },
    data: (obj) => {
      if (json) process.stdout.write(JSON.stringify(obj) + "\n");
    },
  };
  active = reporter;
  return reporter;
}

let interactiveState: boolean | null = null;

/** Sets the interactive decision once, from the entry script's flags + TTY. */
export function setInteractive(value: boolean): void {
  interactiveState = value;
}

/** Whether prompts are allowed. Entry scripts set this; libs read it. */
export function isInteractive(): boolean {
  return interactiveState ?? (Boolean(process.stdin.isTTY) && !isCI());
}

/** Detects a CI environment so scripts never block on prompts there. */
export function isCI(): boolean {
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

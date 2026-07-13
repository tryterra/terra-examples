import pc from "picocolors";

/** Wraps text in the Terra brand blue (#008AFF) as a truecolor ANSI escape. */
function brandBlue(s: string): string {
  return `\x1b[38;2;0;138;255m${s}\x1b[39m`;
}

// Pre-rendered figlet art, embedded static so the CLI carries no figlet dep.
const TERRA = [
  "████████╗███████╗██████╗ ██████╗  █████╗ ",
  "╚══██╔══╝██╔════╝██╔══██╗██╔══██╗██╔══██╗",
  "   ██║   █████╗  ██████╔╝██████╔╝███████║",
  "   ██║   ██╔══╝  ██╔══██╗██╔══██╗██╔══██║",
  "   ██║   ███████╗██║  ██║██║  ██║██║  ██║",
  "   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝",
];
const API = [
  " █████╗ ██████╗ ██╗",
  "██╔══██╗██╔══██╗██║",
  "███████║██████╔╝██║",
  "██╔══██║██╔═══╝ ██║",
  "██║  ██║██║     ██║",
  "╚═╝  ╚═╝╚═╝     ╚═╝",
];
const EXAMPLES = [
  "  _____                           _           ",
  " | ____|_  ____ _ _ __ ___  _ __ | | ___  ___ ",
  " |  _| \\ \\/ / _` | '_ ` _ \\| '_ \\| |/ _ \\/ __|",
  " | |___ >  < (_| | | | | | | |_) | |  __/\\__ \\",
  " |_____/_/\\_\\__,_|_| |_| |_| .__/|_|\\___||___/",
  "                           |_|",
];

/** Prints the "TERRA API" ASCII wordmark banner. */
export function renderTitle(): void {
  const cols = process.stdout.columns ?? 0;
  if (!process.stdout.isTTY || cols < 60) {
    console.log(`\n${pc.bold("TERRA")} ${pc.bold(brandBlue("API"))}\n`);
    return;
  }

  // Same font and baseline, joined side by side: TERRA white, API brand blue.
  const width = Math.max(...TERRA.map((l) => l.length));
  const rows = TERRA.map((line, i) => {
    const left = pc.bold(pc.whiteBright(line.padEnd(width)));
    const right = API[i] ? brandBlue(pc.bold(API[i])) : "";
    return `${left}  ${right}`;
  });

  // "example apps" subtitle, small, in the same white as the wordmark.
  const subtitle = EXAMPLES.map((line) => pc.whiteBright(line));

  console.log(`\n${rows.join("\n")}\n${subtitle.join("\n")}\n`);
}

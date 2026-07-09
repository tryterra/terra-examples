import figlet from "figlet";
import pc from "picocolors";

/** Wraps text in the Terra brand blue (#008AFF) as a truecolor ANSI escape. */
function brandBlue(s: string): string {
  return `\x1b[38;2;0;138;255m${s}\x1b[39m`;
}

/**
 * Prints the "TERRA API" logo as an ASCII banner in one block wordmark:
 * "TERRA" in white and "API" in Terra blue. Falls back to a plain colored
 * wordmark on narrow or non-TTY terminals so piped output and small windows
 * stay tidy.
 */
export function renderTitle(): void {
  const cols = process.stdout.columns ?? 0;
  if (!process.stdout.isTTY || cols < 60) {
    console.log(`\n${pc.bold("TERRA")} ${pc.bold(brandBlue("API"))}\n`);
    return;
  }

  const font = "ANSI Shadow";
  const terra = figlet.textSync("Terra", { font }).replace(/\s+$/, "").split("\n");
  const api = figlet.textSync("API", { font }).replace(/\s+$/, "").split("\n");

  // Same font and baseline, joined side by side: TERRA white, API brand blue.
  const width = Math.max(...terra.map((l) => l.length));
  const rows = terra.map((line, i) => {
    const left = pc.bold(pc.whiteBright(line.padEnd(width)));
    const right = api[i] ? brandBlue(pc.bold(api[i])) : "";
    return `${left}  ${right}`;
  });

  // "example apps" subtitle, small, in the same white as the wordmark.
  const subtitle = figlet
    .textSync("Examples", { font: "standard" })
    .replace(/\s+$/, "")
    .split("\n")
    .map((line) => pc.whiteBright(line));

  console.log(`\n${rows.join("\n")}\n${subtitle.join("\n")}\n`);
}

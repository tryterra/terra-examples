import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

function run(cmd: string, cwd: string): void {
  execSync(cmd, { cwd, stdio: "ignore" });
}

/**
 * Initializes a git repo with an initial commit. Best-effort: returns false
 * (and cleans up a partial .git) if git is missing, we're already inside a
 * repo, or the commit fails (e.g. no user.name configured). Never throws.
 */
export function tryGitInit(cwd: string): boolean {
  try {
    execSync("git --version", { stdio: "ignore" });
  } catch {
    return false;
  }

  // Don't re-init inside an existing repo
  try {
    execSync("git rev-parse --is-inside-work-tree", { cwd, stdio: "ignore" });
    return false;
  } catch {
    // not a repo, so continue
  }

  try {
    try {
      run("git init -b main", cwd);
    } catch {
      run("git init", cwd);
    }
    run("git add -A", cwd);
    run('git commit -m "Initial commit from create-tryterra-app"', cwd);
    return true;
  } catch {
    try {
      rmSync(join(cwd, ".git"), { recursive: true, force: true });
    } catch {
      // ignore cleanup failure
    }
    return false;
  }
}

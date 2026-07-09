import { spawn } from "node:child_process";

interface CommandError extends Error {
  stderr: string;
}

/**
 * Runs a shell command asynchronously with its output hidden (stderr is
 * captured for error reporting). Being async lets a spinner keep animating
 * while the command runs — `execSync` would block the event loop and freeze it.
 */
export function runCommand(command: string, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      const error = new Error(`Command failed: ${command}`) as CommandError;
      error.stderr = stderr;
      reject(error);
    });
  });
}

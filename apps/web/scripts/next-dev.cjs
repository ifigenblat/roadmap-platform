/**
 * Runs `next dev` on port 3001 only. Turbo / `pnpm run dev -- …` can append
 * `--port` / `-p` after our script’s args and Next would honor the last flag,
 * which showed up as `next dev -p 3000` in `ps`. This wrapper drops forwarded
 * port flags then forces `-p 3001`.
 */
const { spawn } = require("node:child_process");
const path = require("node:path");

const appRoot = path.join(__dirname, "..");
/** Hoisted workspaces install `next` at repo root; resolve from the app package. */
const nextPkgJson = require.resolve("next/package.json", { paths: [appRoot] });
const nextBin = path.join(path.dirname(nextPkgJson), "dist", "bin", "next");
process.env.PORT = "3001";
if (process.env.WATCHPACK_POLLING == null || process.env.WATCHPACK_POLLING === "") {
  process.env.WATCHPACK_POLLING = "true";
}

const raw = process.argv.slice(2);
const filtered = [];
for (let i = 0; i < raw.length; i++) {
  const a = raw[i];
  if (a === "-p" || a === "--port") {
    i++;
    continue;
  }
  if (a.startsWith("--port=")) continue;
  filtered.push(a);
}

const child = spawn(process.execPath, [nextBin, "dev", "-p", "3001", ...filtered], {
  stdio: "inherit",
  env: process.env,
  cwd: appRoot,
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

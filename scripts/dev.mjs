import { spawn } from "node:child_process";
import { loadEnv } from "vite";
import { commandCenterApiTarget, commandCenterPort } from "../server/dev-config.mjs";

// Load the same root .env/.env.local family that Vite uses, without overriding
// values explicitly supplied by the parent shell.
const mode = process.env.NODE_ENV || "development";
const fileEnv = loadEnv(mode, process.cwd(), "");
for (const [key, value] of Object.entries(fileEnv)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const port = String(commandCenterPort(process.env));
const apiTarget = commandCenterApiTarget({
  ...process.env,
  COMMAND_CENTER_PORT: port
});
const childEnv = {
  ...process.env,
  COMMAND_CENTER_PORT: port,
  COMMAND_CENTER_API_URL: apiTarget
};
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const shell = process.platform === "win32";
const children = [];
let stopping = false;

function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  }
}

function start(args, env) {
  const child = spawn(pnpm, ["exec", ...args], { env, stdio: "inherit", shell });
  children.push(child);
  child.once("error", error => {
    console.error("Command Center dev process failed to start:", error);
    process.exitCode = 1;
    stop("SIGTERM");
  });
  child.once("exit", (code, signal) => {
    if (!stopping) {
      process.exitCode = code ?? (signal ? 1 : 0);
      stop("SIGTERM");
    }
  });
  return child;
}

start(["tsx", "server/index.ts"], { ...childEnv, PORT: port });
start(["vite", "--host"], childEnv);
process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));

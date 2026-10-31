import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("TEST_SERVER_ADDRESS_UNAVAILABLE");
  return address.port;
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

async function availablePort(excluded: Set<number>): Promise<number> {
  for (;;) {
    const probe = createServer();
    const port = await listen(probe);
    await close(probe);
    if (!excluded.has(port)) {
      excluded.add(port);
      return port;
    }
  }
}

async function waitForJson(url: string, child: ChildProcess, output: () => string): Promise<Response> {
  const deadline = Date.now() + 15_000;
  let last = "server has not responded";
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Command Center dev stack exited early: ${last}\n${output()}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      const contentType = response.headers.get("content-type") ?? "";
      if (response.ok && contentType.includes("application/json")) return response;
      last = `HTTP ${response.status} (${contentType || "no content type"})`;
      await response.body?.cancel();
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for proxied API at ${url}: ${last}\n${output()}`);
}

function healthServer(payload: unknown): Server {
  return createServer((request, response) => {
    if (request.url !== "/health") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not found" }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(payload));
  });
}

describe("Command Center development stack", () => {
  it("starts the API and UI on explicit ports and reaches both upstreams through the Vite proxy", async () => {
    const nodeGate = healthServer({
      status: "OPERATIONAL",
      gate: "node-gate",
      version: "integration-fixture",
      narrative_state: "ready"
    });
    const evidenceos = healthServer({
      status: "ok",
      version: "integration-fixture",
      schema: "v1",
      uptime_s: 1,
      jobs: { active: 0, tracked: 0, max_concurrent: 1, result_ttl_ms: 1000 },
      token_env_present: false
    });

    let child: ChildProcess | undefined;
    let output = "";
    let childExit: Promise<{ code: number | null; signal: NodeJS.Signals | null }> | undefined;
    try {
      const nodeGatePort = await listen(nodeGate);
      const evidenceosPort = await listen(evidenceos);
      const reserved = new Set([nodeGatePort, evidenceosPort]);
      const apiPort = await availablePort(reserved);
      const uiPort = await availablePort(reserved);
      const root = fileURLToPath(new URL("../", import.meta.url));
      const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
      child = spawn(command, ["dev"], {
        cwd: root,
        env: {
          ...process.env,
          NODE_ENV: "development",
          COMMAND_CENTER_PORT: String(apiPort),
          COMMAND_CENTER_UI_PORT: String(uiPort),
          COMMAND_CENTER_API_HOST: "127.0.0.1",
          COMMAND_CENTER_UI_HOST: "127.0.0.1",
          COMMAND_CENTER_API_URL: "",
          NODE_GATE_URL: `http://127.0.0.1:${nodeGatePort}`,
          EVIDENCEOS_URL: `http://127.0.0.1:${evidenceosPort}`
        },
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32"
      });
      child.stdout?.on("data", chunk => { output += chunk.toString(); });
      child.stderr?.on("data", chunk => { output += chunk.toString(); });
      childExit = new Promise(resolve => {
        child?.once("exit", (code, signal) => resolve({ code, signal }));
      });

      const response = await waitForJson(
        `http://127.0.0.1:${uiPort}/api/capabilities`,
        child,
        () => output
      );
      expect(response.status).toBe(200);
      const payload = await response.json() as {
        service: string;
        capabilities: Array<{ id: string; status: string; url: string }>;
      };
      expect(payload.service).toBe("command-center");
      expect(payload.capabilities).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: "node-gate",
          status: "OPERATIONAL",
          url: `http://127.0.0.1:${nodeGatePort}`
        }),
        expect.objectContaining({
          id: "evidenceos",
          status: "OPERATIONAL",
          url: `http://127.0.0.1:${evidenceosPort}`
        })
      ]));

      const uiResponse = await fetch(`http://127.0.0.1:${uiPort}/`, {
        signal: AbortSignal.timeout(2000)
      });
      expect(uiResponse.status).toBe(200);
      expect(uiResponse.headers.get("content-type")).toContain("text/html");
      await uiResponse.body?.cancel();
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        const stopped = childExit
          ? await Promise.race([childExit, delay(5000).then(() => null)])
          : null;
        if (stopped === null) {
          child.kill("SIGKILL");
          if (childExit) await Promise.race([childExit, delay(2000)]);
        }
      }
      await Promise.all([close(nodeGate), close(evidenceos)]);
    }
  }, 30_000);
});

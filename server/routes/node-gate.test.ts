import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, request as httpRequest, type Server } from "node:http";
import { nodeGate, NodeGateUpstreamError } from "../node-gate-client";
import router from "./node-gate";

type JsonResponse = { status: number; body: any };

async function startServer(): Promise<{ server: Server; port: number }> {
  const app = express();
  app.use(express.json());
  app.use("/api/node-gate", router);
  const server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server did not expose a TCP address");
  }
  return { server, port: address.port };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

function get(port: number, path: string): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: "127.0.0.1",
      port,
      path,
      method: "GET",
    }, response => {
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { raw += chunk; });
      response.on("end", () => {
        try {
          resolve({
            status: response.statusCode ?? 0,
            body: raw ? JSON.parse(raw) : null,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end();
  });
}

function post(port: number, path: string, body: unknown): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: { "content-type": "application/json" },
    }, response => {
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { raw += chunk; });
      response.on("end", () => {
        try {
          resolve({
            status: response.statusCode ?? 0,
            body: raw ? JSON.parse(raw) : null,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(JSON.stringify(body));
  });
}

describe("Node-Gate intervention route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["missing", {}],
    ["number", { input: 42 }],
    ["object", { input: { text: "not a string" } }],
    ["whitespace", { input: "  \t\n " }],
  ])("rejects %s input before calling Node-Gate", async (_label, body) => {
    const intervene = vi.spyOn(nodeGate, "intervene").mockResolvedValue({} as never);
    const { server, port } = await startServer();
    try {
      const response = await post(port, "/api/node-gate/intervene", body);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ error: "MISSING_INPUT" });
      expect(intervene).not.toHaveBeenCalled();
    } finally {
      await closeServer(server);
    }
  });

  it("preserves an unstructured upstream HTTP failure instead of converting it to 500", async () => {
    const intervene = vi.spyOn(nodeGate, "intervene").mockRejectedValue(
      new NodeGateUpstreamError("upstream token sample-intervention-secret", 502)
    );
    const { server, port } = await startServer();
    try {
      const response = await post(port, "/api/node-gate/intervene", { input: "bounded fixture" });
      expect(response.status).toBe(502);
      expect(response.body).toMatchObject({
        error: "NODE_GATE_REJECTED",
        message: "Node-Gate returned HTTP 502",
        upstream_status: 502,
      });
      expect(intervene).toHaveBeenCalledWith("bounded fixture");
      expect(JSON.stringify(response.body)).not.toContain("sample-intervention-secret");
    } finally {
      await closeServer(server);
    }
  });

  it("preserves valid input bytes rather than trimming user text", async () => {
    const intervene = vi.spyOn(nodeGate, "intervene").mockResolvedValue({} as never);
    const { server, port } = await startServer();
    try {
      const response = await post(port, "/api/node-gate/intervene", { input: "  inspect this  " });
      expect(response.status).toBe(200);
      expect(intervene).toHaveBeenCalledWith("  inspect this  ");
    } finally {
      await closeServer(server);
    }
  });
});

describe("Node-Gate deliberation route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["missing", {}],
    ["number", { input: 42 }],
    ["whitespace", { input: "   " }],
  ])("rejects %s input before calling Node-Gate", async (_label, body) => {
    const deliberate = vi.spyOn(nodeGate, "deliberate").mockResolvedValue({} as never);
    const { server, port } = await startServer();
    try {
      const response = await post(port, "/api/node-gate/deliberate", body);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ error: "MISSING_INPUT" });
      expect(deliberate).not.toHaveBeenCalled();
    } finally {
      await closeServer(server);
    }
  });

  it("preserves deliberation status without reflecting upstream error text", async () => {
    const secret = "sample-deliberation-secret";
    const deliberate = vi.spyOn(nodeGate, "deliberate").mockRejectedValue(
      new NodeGateUpstreamError("upstream token " + secret, 429)
    );
    const { server, port } = await startServer();
    try {
      const response = await post(port, "/api/node-gate/deliberate", { input: "bounded fixture" });
      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({
        error: "NODE_GATE_REJECTED",
        message: "Node-Gate returned HTTP 429",
        upstream_status: 429,
      });
      expect(JSON.stringify(response.body)).not.toContain(secret);
      expect(deliberate).toHaveBeenCalledWith("bounded fixture", [], 5);
    } finally {
      await closeServer(server);
    }
  });
});

describe("Node-Gate taxonomy route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves typed upstream HTTP status codes", async () => {
    const taxonomy = vi.spyOn(nodeGate, "taxonomy").mockRejectedValue(
      new NodeGateUpstreamError("upstream token sample-taxonomy-secret", 429)
    );
    const { server, port } = await startServer();
    try {
      const response = await get(port, "/api/node-gate/taxonomy");
      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({
        error: "NODE_GATE_REJECTED",
        message: "Node-Gate returned HTTP 429",
        upstream_status: 429,
      });
      expect(taxonomy).toHaveBeenCalledOnce();
      expect(JSON.stringify(response.body)).not.toContain("sample-taxonomy-secret");
    } finally {
      await closeServer(server);
    }
  });
});


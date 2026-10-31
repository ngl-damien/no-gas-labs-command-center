import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, request as httpRequest, type Server } from "node:http";
import { evidenceos } from "../evidenceos-client";
import router from "./evidenceos";

type JsonResponse = { status: number; body: any };

async function startServer(): Promise<{ server: Server; port: number }> {
  const app = express();
  app.use(express.json());
  app.use("/api/evidenceos", router);
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

function postAnalyze(port: number, body: unknown): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: "127.0.0.1",
      port,
      path: "/api/evidenceos/analyze",
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

describe("EvidenceOS analyze route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects string-valued async flags instead of coercing false into true", async () => {
    const analyze = vi.spyOn(evidenceos, "analyze").mockResolvedValue({
      trace_id: "trace-1",
      status: "accepted",
      status_url: "http://evidenceos.internal/v1/jobs/trace-1",
      poll_hint: "poll",
    });

    const { server, port } = await startServer();
    try {
      const response = await postAnalyze(port, { owner: "octocat", async: "false" });
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ error: "INVALID_ASYNC" });
      expect(analyze).not.toHaveBeenCalled();
    } finally {
      await closeServer(server);
    }
  });

  it("encodes the trace ID and keeps asynchronous polling on the proxy surface", async () => {
    const analyze = vi.spyOn(evidenceos, "analyze").mockResolvedValue({
      trace_id: "trace/alpha",
      status: "accepted",
      status_url: "http://evidenceos.internal/v1/jobs/trace%2Falpha",
      poll_hint: "poll",
    });

    const { server, port } = await startServer();
    try {
      const response = await postAnalyze(port, { owner: "octocat", async: true });
      expect(response.status).toBe(202);
      expect(response.body.status_url).toBe("/api/evidenceos/jobs/trace%2Falpha");
      expect(response.body.status_url).not.toContain("evidenceos.internal");
      expect(analyze).toHaveBeenCalledWith("octocat", "user", true);
    } finally {
      await closeServer(server);
    }
  });

  it("rejects an async acceptance without a usable trace ID", async () => {
    const analyze = vi.spyOn(evidenceos, "analyze").mockResolvedValue({
      trace_id: " ",
      status: "accepted",
      status_url: "http://evidenceos.internal/v1/jobs/missing",
      poll_hint: "poll",
    });

    const { server, port } = await startServer();
    try {
      const response = await postAnalyze(port, { owner: "octocat", async: true });
      expect(response.status).toBe(502);
      expect(response.body).toMatchObject({ error: "EVIDENCEOS_INVALID_RESPONSE" });
      expect(analyze).toHaveBeenCalledWith("octocat", "user", true);
    } finally {
      await closeServer(server);
    }
  });
});

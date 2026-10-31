import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeGateClient, NodeGateUpstreamError } from "./node-gate-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NodeGateClient.health", () => {
  it("rejects a non-success HTTP response even when its body claims OPERATIONAL", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ status: "OPERATIONAL" }),
      { status: 503, headers: { "content-type": "application/json" } }
    )));

    await expect(new NodeGateClient("http://node-gate").health())
      .rejects.toBeInstanceOf(NodeGateUpstreamError);
  });

  it("returns health data only after a successful HTTP response", async () => {
    const payload = {
      status: "OPERATIONAL",
      gate: "node-gate",
      version: "test",
      narrative_state: "ready",
      timestamp: "2026-10-31T00:00:00.000Z"
    };
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify(payload),
      { status: 200, headers: { "content-type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new NodeGateClient("http://node-gate").health()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("http://node-gate/health");
  });
});

import { describe, expect, it, vi } from "vitest";
import { collectCapabilityHealth } from "./capability-health";

describe("collectCapabilityHealth", () => {
  it("starts both upstream probes before waiting for either result", async () => {
    const calls: string[] = [];
    let resolveNodeGate!: (value: unknown) => void;
    let resolveEvidenceOS!: (value: unknown) => void;
    const nodeGate = {
      baseUrl: "http://127.0.0.1:3001",
      health: vi.fn(() => {
        calls.push("node-gate");
        return new Promise<unknown>(resolve => { resolveNodeGate = resolve; });
      }),
    };
    const evidenceos = {
      baseUrl: "http://127.0.0.1:3002",
      health: vi.fn(() => {
        calls.push("evidenceos");
        return new Promise<unknown>(resolve => { resolveEvidenceOS = resolve; });
      }),
    };

    const pending = collectCapabilityHealth(nodeGate, evidenceos);
    expect(calls).toEqual(["node-gate", "evidenceos"]);
    expect(nodeGate.health).toHaveBeenCalledOnce();
    expect(evidenceos.health).toHaveBeenCalledOnce();

    resolveNodeGate({ status: "OPERATIONAL", version: "node-gate-test" });
    resolveEvidenceOS({
      status: "ok",
      version: "evidenceos-test",
      schema: "v1",
      uptime_s: 12,
      jobs: { active: 0 },
      token_env_present: false,
    });

    const records = await pending;
    expect(records.map(record => record.status)).toEqual(["OPERATIONAL", "OPERATIONAL"]);
    expect(records.map(record => record.id)).toEqual(["node-gate", "evidenceos"]);
  });

  it("preserves one upstream's failure without hiding the other upstream's health", async () => {
    const nodeGate = {
      baseUrl: "http://127.0.0.1:3001",
      health: vi.fn().mockRejectedValue(new Error("connection refused")),
    };
    const evidenceos = {
      baseUrl: "http://127.0.0.1:3002",
      health: vi.fn().mockResolvedValue({
        status: "ok",
        version: "evidenceos-test",
        schema: "v1",
        uptime_s: 12,
        jobs: { active: 0 },
        token_env_present: false,
      }),
    };

    const records = await collectCapabilityHealth(nodeGate, evidenceos);
    expect(records[0]).toMatchObject({
      id: "node-gate",
      status: "UNAVAILABLE",
      detail: { reason: "Error: connection refused" },
    });
    expect(records[1]).toMatchObject({
      id: "evidenceos",
      status: "OPERATIONAL",
      detail: { version: "evidenceos-test", token_env_present: false },
    });
    expect(Date.parse(String(records[0].probed_at))).not.toBeNaN();
    expect(Date.parse(String(records[1].probed_at))).not.toBeNaN();
  });

  it("marks a successful but malformed health body as degraded, not operational", async () => {
    const nodeGate = {
      baseUrl: "http://127.0.0.1:3001",
      health: vi.fn().mockResolvedValue({ status: "UNKNOWN" }),
    };
    const evidenceos = {
      baseUrl: "http://127.0.0.1:3002",
      health: vi.fn().mockResolvedValue({ status: "unknown" }),
    };

    const records = await collectCapabilityHealth(nodeGate, evidenceos);
    expect(records.map(record => record.status)).toEqual(["DEGRADED", "DEGRADED"]);
  });
});

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
      detail: { reason: "UPSTREAM_PROBE_FAILED" },
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


describe("public capability health redaction", () => {
  it("exposes only upstream origins and allowlisted health fields", async () => {
    const nodeGate = {
      baseUrl: "https://operator:password@node-gate.example:8443/internal?token=ghp_node_secret#fragment",
      health: vi.fn().mockResolvedValue({
        status: "OPERATIONAL",
        gate: "node-gate",
        version: "v1",
        narrative_state: "ready",
        timestamp: "2026-10-31T16:00:00.000Z",
        access_token: "ghp_node_secret",
        nested: { private_key: "node-private-secret" },
      }),
    };
    const evidenceos = {
      baseUrl: "https://operator:password@evidenceos.example:9443/internal?token=ghp_evidence_secret#fragment",
      health: vi.fn().mockResolvedValue({
        status: "ok",
        version: "v2",
        schema: "v1",
        uptime_s: 12,
        jobs: {
          active: 1,
          tracked: 2,
          max_concurrent: 3,
          result_ttl_ms: 4000,
          access_token: "ghp_jobs_secret",
        },
        token_env_present: true,
        token: "ghp_evidence_secret",
      }),
    };

    const records = await collectCapabilityHealth(nodeGate, evidenceos);
    expect(records[0].url).toBe("https://node-gate.example:8443");
    expect(records[1].url).toBe("https://evidenceos.example:9443");
    expect(records[0].detail).toEqual({
      status: "OPERATIONAL",
      gate: "node-gate",
      version: "v1",
      narrative_state: "ready",
      timestamp: "2026-10-31T16:00:00.000Z",
    });
    expect(records[1].detail).toEqual({
      version: "v2",
      schema: "v1",
      uptime_s: 12,
      jobs: {
        active: 1,
        tracked: 2,
        max_concurrent: 3,
        result_ttl_ms: 4000,
      },
      token_env_present: true,
    });

    const publicJson = JSON.stringify(records);
    for (const secret of [
      "operator",
      "password",
      "ghp_node_secret",
      "node-private-secret",
      "ghp_evidence_secret",
      "ghp_jobs_secret",
      "/internal",
      "fragment",
    ]) {
      expect(publicJson).not.toContain(secret);
    }
  });

  it("does not reflect malformed upstream URLs or error messages", async () => {
    const nodeGate = {
      baseUrl: "not-a-valid-upstream-url?token=ghp_invalid_secret",
      health: vi.fn().mockRejectedValue(new Error("request failed: ghp_error_secret")),
    };
    const evidenceos = {
      baseUrl: "https://user:password@evidenceos.example?token=ghp_evidence_secret",
      health: vi.fn().mockRejectedValue(new Error("upstream rejected: ghp_evidence_secret")),
    };

    const records = await collectCapabilityHealth(nodeGate, evidenceos);
    expect(records.map(record => record.url)).toEqual([
      "invalid-upstream-url",
      "https://evidenceos.example",
    ]);
    expect(records.map(record => record.detail)).toEqual([
      { reason: "UPSTREAM_PROBE_FAILED" },
      { reason: "UPSTREAM_PROBE_FAILED" },
    ]);

    const publicJson = JSON.stringify(records);
    for (const secret of [
      "ghp_invalid_secret",
      "ghp_error_secret",
      "ghp_evidence_secret",
      "user",
      "password",
    ]) {
      expect(publicJson).not.toContain(secret);
    }
  });
});

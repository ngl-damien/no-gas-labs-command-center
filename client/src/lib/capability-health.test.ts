import { describe, expect, it, vi } from "vitest";
import {
  fetchCapabilityRecords,
  parseCapabilityRecords,
  summarizeCapabilityHealth,
  type CapabilityRecord,
} from "./capability-health";

const operational: CapabilityRecord[] = [
  { id: "node-gate", name: "Node-Gate", url: "http://127.0.0.1:3001", status: "OPERATIONAL" },
  { id: "evidenceos", name: "EvidenceOS", url: "http://127.0.0.1:3002", status: "OPERATIONAL" },
];

describe("live capability health", () => {
  it("accepts the complete expected upstream set in either order", () => {
    expect(parseCapabilityRecords({ capabilities: operational })).toEqual(operational);
    expect(parseCapabilityRecords({ capabilities: [...operational].reverse() })).toEqual([...operational].reverse());
  });

  it("rejects missing or malformed capability data instead of treating it as outages", () => {
    expect(parseCapabilityRecords(null)).toBeNull();
    expect(parseCapabilityRecords({})).toBeNull();
    expect(parseCapabilityRecords({ capabilities: "offline" })).toBeNull();
    expect(parseCapabilityRecords({ capabilities: [{ id: "node-gate", status: "UNKNOWN" }] })).toBeNull();
  });

  it("rejects sparse capability arrays rather than treating skipped entries as healthy", () => {
    expect(parseCapabilityRecords({ capabilities: new Array(2) })).toBeNull();
  });

  it("does not report operational when one required upstream is missing", () => {
    const partial = [operational[0]];
    expect(parseCapabilityRecords({ capabilities: partial })).toBeNull();
    expect(summarizeCapabilityHealth(partial)).toBe("UNKNOWN");
  });

  it("rejects duplicate IDs that could mask a missing required upstream", () => {
    const duplicated = [operational[0], { ...operational[0] }];
    expect(parseCapabilityRecords({ capabilities: duplicated })).toBeNull();
    expect(summarizeCapabilityHealth(duplicated)).toBe("UNKNOWN");
  });

  it("rejects unknown IDs even when the returned rows are operational", () => {
    const substituted = [operational[0], { ...operational[1], id: "other-service" }];
    expect(parseCapabilityRecords({ capabilities: substituted })).toBeNull();
    expect(summarizeCapabilityHealth(substituted)).toBe("UNKNOWN");
  });

  it("reports operational only when every required upstream is operational", () => {
    expect(summarizeCapabilityHealth(operational)).toBe("OPERATIONAL");
  });

  it("reports unavailable when every observed upstream is unavailable", () => {
    const unavailable = operational.map((record) => ({ ...record, status: "UNAVAILABLE" as const }));
    expect(summarizeCapabilityHealth(unavailable)).toBe("UNAVAILABLE");
  });

  it("reports degraded when upstream results are mixed or degraded", () => {
    expect(summarizeCapabilityHealth([
      operational[0],
      { ...operational[1], status: "UNAVAILABLE" },
    ])).toBe("DEGRADED");
    expect(summarizeCapabilityHealth([
      { ...operational[0], status: "DEGRADED" },
      operational[1],
    ])).toBe("DEGRADED");
  });

  it("reports unknown for empty, malformed, or sparse summary input", () => {
    expect(summarizeCapabilityHealth([])).toBe("UNKNOWN");
    expect(summarizeCapabilityHealth(null)).toBe("UNKNOWN");
    expect(summarizeCapabilityHealth(new Array(2) as CapabilityRecord[])).toBe("UNKNOWN");
  });
});


describe("bounded capability health fetch", () => {
  it("aborts an unresponsive API request within its configured deadline", async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error("capability fetch must have an abort signal"));
          return;
        }
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      })
    );

    await expect(fetchCapabilityRecords(fetcher, 10)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

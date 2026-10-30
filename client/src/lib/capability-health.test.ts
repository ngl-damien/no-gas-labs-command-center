import { describe, expect, it } from "vitest";
import {
  parseCapabilityRecords,
  summarizeCapabilityHealth,
  type CapabilityRecord,
} from "./capability-health";

const operational: CapabilityRecord[] = [
  { id: "node-gate", name: "Node-Gate", url: "http://127.0.0.1:3001", status: "OPERATIONAL" },
  { id: "evidenceos", name: "EvidenceOS", url: "http://127.0.0.1:3002", status: "OPERATIONAL" },
];

describe("live capability health", () => {
  it("accepts a well-shaped capability response", () => {
    expect(parseCapabilityRecords({ capabilities: operational })).toEqual(operational);
  });

  it("rejects missing or malformed capability data instead of treating it as outages", () => {
    expect(parseCapabilityRecords(null)).toBeNull();
    expect(parseCapabilityRecords({})).toBeNull();
    expect(parseCapabilityRecords({ capabilities: "offline" })).toBeNull();
    expect(parseCapabilityRecords({ capabilities: [{ id: "node-gate", status: "UNKNOWN" }] })).toBeNull();
  });

  it("rejects sparse capability arrays rather than treating skipped entries as healthy", () => {
    expect(parseCapabilityRecords({ capabilities: new Array(1) })).toBeNull();
  });

  it("reports operational only when every observed upstream is operational", () => {
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

  it("reports unknown for empty or unavailable-to-parse data", () => {
    expect(summarizeCapabilityHealth([])).toBe("UNKNOWN");
    expect(summarizeCapabilityHealth(null)).toBe("UNKNOWN");
  });
});

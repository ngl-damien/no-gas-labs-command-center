export type CapabilityStatus = "OPERATIONAL" | "DEGRADED" | "UNAVAILABLE";
export type CapabilityHealthState = "CHECKING" | CapabilityStatus | "UNKNOWN";

export interface CapabilityRecord {
  id: string;
  name: string;
  url: string;
  status: CapabilityStatus;
  kind?: string;
  detail?: unknown;
  probed_at?: string;
}

const VALID_STATUSES = new Set<CapabilityStatus>([
  "OPERATIONAL",
  "DEGRADED",
  "UNAVAILABLE",
]);

// The current Command Center API has exactly two intended upstreams. A
// partial or duplicated list must not make the home page claim all upstreams
// are operational merely because every returned row happens to be healthy.
const EXPECTED_CAPABILITY_IDS = new Set(["node-gate", "evidenceos"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Parse the live /api/capabilities response without treating malformed,
 * missing, duplicated, or incomplete data as an empty list of failed upstreams.
 */
export function parseCapabilityRecords(payload: unknown): CapabilityRecord[] | null {
  if (!isObject(payload) || !Array.isArray(payload.capabilities)) return null;

  const records = payload.capabilities;
  if (records.length !== EXPECTED_CAPABILITY_IDS.size) return null;

  const seen = new Set<string>();
  for (let index = 0; index < records.length; index += 1) {
    // Array.prototype.every skips holes; accepting one could make a sparse
    // response look like an all-operational result during summary.
    if (!Object.prototype.hasOwnProperty.call(records, index)) return null;

    const record: unknown = records[index];
    if (!isObject(record)) return null;
    if (
      typeof record.id !== "string" ||
      !EXPECTED_CAPABILITY_IDS.has(record.id) ||
      seen.has(record.id) ||
      typeof record.name !== "string" ||
      record.name.length === 0 ||
      typeof record.url !== "string" ||
      record.url.length === 0 ||
      typeof record.status !== "string" ||
      !VALID_STATUSES.has(record.status as CapabilityStatus)
    ) {
      return null;
    }
    seen.add(record.id);
  }

  return seen.size === EXPECTED_CAPABILITY_IDS.size ? records as CapabilityRecord[] : null;
}

/**
 * Summarize only the complete, observed upstream set. Missing or malformed
 * records are UNKNOWN; mixed/partial health is never fully OPERATIONAL.
 */
export function summarizeCapabilityHealth(
  records: CapabilityRecord[] | null,
): CapabilityHealthState {
  const validatedRecords = records === null
    ? null
    : parseCapabilityRecords({ capabilities: records });
  if (validatedRecords === null || validatedRecords.length === 0) return "UNKNOWN";

  if (validatedRecords.every((record) => record.status === "OPERATIONAL")) {
    return "OPERATIONAL";
  }
  if (validatedRecords.every((record) => record.status === "UNAVAILABLE")) {
    return "UNAVAILABLE";
  }
  return "DEGRADED";
}

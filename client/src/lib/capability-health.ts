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

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Parse the live /api/capabilities response without treating malformed or
 * missing data as an empty list of failed upstreams.
 */
export function parseCapabilityRecords(payload: unknown): CapabilityRecord[] | null {
  if (!isObject(payload) || !Array.isArray(payload.capabilities)) return null;

  const records = payload.capabilities;
  for (let index = 0; index < records.length; index += 1) {
    // Array.prototype.every skips holes; accepting one could make a sparse
    // response look like an all-operational result during summary.
    if (!Object.prototype.hasOwnProperty.call(records, index)) return null;

    const record: unknown = records[index];
    if (!isObject(record)) return null;
    if (
      typeof record.id !== "string" ||
      record.id.length === 0 ||
      typeof record.name !== "string" ||
      typeof record.url !== "string" ||
      typeof record.status !== "string" ||
      !VALID_STATUSES.has(record.status as CapabilityStatus)
    ) {
      return null;
    }
  }

  return records as CapabilityRecord[];
}

/**
 * Summarize only observed upstream records. An empty or malformed response
 * is UNKNOWN; mixed/partial results are DEGRADED, never fully OPERATIONAL.
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

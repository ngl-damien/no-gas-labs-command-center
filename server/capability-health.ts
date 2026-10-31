export interface CapabilityHealthClient {
  baseUrl: string;
  health(): Promise<unknown>;
}

type ProbeResult =
  | { ok: true; value: unknown; probed_at: string }
  | { ok: false; reason: unknown; probed_at: string };

async function probe(client: CapabilityHealthClient): Promise<ProbeResult> {
  try {
    return {
      ok: true,
      value: await client.health(),
      probed_at: new Date().toISOString(),
    };
  } catch (reason) {
    return {
      ok: false,
      reason,
      probed_at: new Date().toISOString(),
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

// The browser-facing health endpoint is not an operator secret store. Expose
// only an upstream origin; never reflect URL userinfo, paths, query strings,
// fragments, or malformed configuration back to every connected client.
function publicUpstreamOrigin(value: string): string {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
      return "invalid-upstream-url";
    }
    return url.origin;
  } catch {
    return "invalid-upstream-url";
  }
}

function safeText(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length <= 256 ? value : undefined;
}

function safeNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function safeNodeGateDetail(value: unknown): Record<string, unknown> {
  const health = asRecord(value);
  return {
    status: safeText(health, "status"),
    gate: safeText(health, "gate"),
    version: safeText(health, "version"),
    narrative_state: safeText(health, "narrative_state"),
    timestamp: safeText(health, "timestamp"),
  };
}

function safeEvidenceOSDetail(value: unknown): Record<string, unknown> {
  const health = asRecord(value);
  const jobs = asRecord(health.jobs);
  return {
    version: safeText(health, "version"),
    schema: safeText(health, "schema"),
    uptime_s: safeNonNegativeNumber(health.uptime_s),
    jobs: {
      active: safeNonNegativeNumber(jobs.active),
      tracked: safeNonNegativeNumber(jobs.tracked),
      max_concurrent: safeNonNegativeNumber(jobs.max_concurrent),
      result_ttl_ms: safeNonNegativeNumber(jobs.result_ttl_ms),
    },
    // Boolean only — token presence, never a token value or extra upstream fields.
    token_env_present: typeof health.token_env_present === "boolean"
      ? health.token_env_present
      : undefined,
  };
}

function safeFailure(): { reason: string } {
  // Error messages can contain request URLs or upstream-supplied secrets.
  // Keep the public health response useful without reflecting those values.
  return { reason: "UPSTREAM_PROBE_FAILED" };
}

/**
 * Probe both required upstreams concurrently. Each failure is isolated so a
 * slow or unavailable service cannot prevent the other capability from being
 * observed; the client-level timeout still bounds each individual probe.
 */
export async function collectCapabilityHealth(
  nodeGate: CapabilityHealthClient,
  evidenceos: CapabilityHealthClient,
): Promise<Array<Record<string, unknown>>> {
  const [nodeGateResult, evidenceosResult] = await Promise.all([
    probe(nodeGate),
    probe(evidenceos),
  ]);

  const nodeGateHealth = nodeGateResult.ok ? asRecord(nodeGateResult.value) : {};
  const evidenceosHealth = evidenceosResult.ok ? asRecord(evidenceosResult.value) : {};

  return [
    {
      id: "node-gate",
      name: "AI-BI Intelligence Node-Gate",
      kind: "upstream",
      url: publicUpstreamOrigin(nodeGate.baseUrl),
      status: !nodeGateResult.ok
        ? "UNAVAILABLE"
        : nodeGateHealth.status === "OPERATIONAL" ? "OPERATIONAL" : "DEGRADED",
      detail: nodeGateResult.ok ? safeNodeGateDetail(nodeGateResult.value) : safeFailure(),
      probed_at: nodeGateResult.probed_at,
    },
    {
      id: "evidenceos",
      name: "EvidenceOS Inference Engine",
      kind: "upstream",
      url: publicUpstreamOrigin(evidenceos.baseUrl),
      status: !evidenceosResult.ok
        ? "UNAVAILABLE"
        : evidenceosHealth.status === "ok" ? "OPERATIONAL" : "DEGRADED",
      detail: evidenceosResult.ok
        ? safeEvidenceOSDetail(evidenceosResult.value)
        : safeFailure(),
      probed_at: evidenceosResult.probed_at,
    },
  ];
}

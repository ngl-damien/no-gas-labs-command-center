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
      url: nodeGate.baseUrl,
      status: !nodeGateResult.ok
        ? "UNAVAILABLE"
        : nodeGateHealth.status === "OPERATIONAL" ? "OPERATIONAL" : "DEGRADED",
      detail: nodeGateResult.ok ? nodeGateResult.value : { reason: String(nodeGateResult.reason) },
      probed_at: nodeGateResult.probed_at,
    },
    {
      id: "evidenceos",
      name: "EvidenceOS Inference Engine",
      kind: "upstream",
      url: evidenceos.baseUrl,
      status: !evidenceosResult.ok
        ? "UNAVAILABLE"
        : evidenceosHealth.status === "ok" ? "OPERATIONAL" : "DEGRADED",
      detail: evidenceosResult.ok
        ? {
            version: evidenceosHealth.version,
            schema: evidenceosHealth.schema,
            uptime_s: evidenceosHealth.uptime_s,
            jobs: evidenceosHealth.jobs,
            // Boolean only — token presence, never a token value.
            token_env_present: evidenceosHealth.token_env_present,
          }
        : { reason: String(evidenceosResult.reason) },
      probed_at: evidenceosResult.probed_at,
    },
  ];
}

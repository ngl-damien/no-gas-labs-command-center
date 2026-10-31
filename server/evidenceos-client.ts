/**
 * EVIDENCEOS CLIENT
 * Integration module for the EvidenceOS HTTP API (two-pass repository analysis)
 *
 * Wires the Command Center to the EvidenceOS Inference Engine so capability
 * health reflects the REAL upstream state and analysis requests flow through
 * one authenticated surface.
 *
 * Token policy: the Command Center never handles GitHub tokens for analysis.
 * EvidenceOS resolves its own GITHUB_TOKEN from its environment; responses
 * carry only a sha256 fingerprint, never a token value.
 *
 * Copyright (c) 2025-2026 Damien Edward Featherstone / No-Gas-Labs™
 */

export interface EvidenceOSHealth {
  status: string;
  service: string;
  version: string;
  schema: string;
  uptime_s: number;
  jobs: {
    active: number;
    tracked: number;
    max_concurrent: number;
    result_ttl_ms: number;
  };
  token_env_present: boolean;
  time_utc: string;
}

/** 202 response from POST /v1/analyze?async=1 */
export interface AnalyzeAccepted {
  trace_id: string;
  status: string;
  status_url: string;
  poll_hint: string;
}

/** Full provenance envelope from sync analysis or a completed job */
export interface AnalyzeEnvelope {
  trace_id: string;
  schema: string;
  generated_at: string;
  request: { owner: string; type: string };
  provenance: Record<string, any>;
  result: Record<string, any>;
  summary: Record<string, number>;
}

/** Error thrown when the EvidenceOS surface rejects or fails a request. */
export class EvidenceOSUpstreamError extends Error {
  public status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "EvidenceOSUpstreamError";
    this.status = status;
  }
}

export class EvidenceOSClient {
  // Public so the capability-health screen can report the configured
  // upstream URL without re-reading process.env separately.
  public baseUrl: string;
  private readonly healthTimeoutMs: number;
  private readonly requestTimeoutMs: number;

  constructor(baseUrl: string = "http://localhost:3002", healthTimeoutMs: number = 3000, requestTimeoutMs: number = 30000) {
    if (!Number.isSafeInteger(healthTimeoutMs) || healthTimeoutMs < 1 || healthTimeoutMs > 30000) {
      throw new RangeError("HEALTH_TIMEOUT_INVALID");
    }
    if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 120000) {
      throw new RangeError("REQUEST_TIMEOUT_INVALID");
    }
    this.baseUrl = baseUrl;
    this.healthTimeoutMs = healthTimeoutMs;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  /**
   * Check EvidenceOS health status (GET /health)
   */
  async health(): Promise<EvidenceOSHealth> {
    const response = await fetch(`${this.baseUrl}/health`, {
      signal: AbortSignal.timeout(this.healthTimeoutMs),
    });
    if (!response.ok) {
      throw new EvidenceOSUpstreamError(
        `EvidenceOS /health returned ${response.status}`,
        response.status
      );
    }
    return response.json();
  }

  /**
   * Get the response envelope schema documentation (GET /v1/schema)
   */
  async schema(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/v1/schema`, {
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });
    if (!response.ok) {
      throw new EvidenceOSUpstreamError(
        `EvidenceOS /v1/schema returned ${response.status}`,
        response.status
      );
    }
    return response.json();
  }

  /**
   * Run a two-pass analysis (POST /v1/analyze).
   *
   * Sync mode awaits the full provenance envelope; async mode returns
   * immediately with { trace_id, status_url } for phone/flaky links.
   */
  async analyze(
    owner: string,
    type: "user" | "org" = "user",
    asyncMode: boolean = false
  ): Promise<AnalyzeAccepted | AnalyzeEnvelope> {
    const response = await fetch(
      `${this.baseUrl}/v1/analyze${asyncMode ? "?async=1" : ""}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, type }),
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      }
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as any;
      throw new EvidenceOSUpstreamError(
        body.message || body.error || "EvidenceOS rejected the analysis request",
        response.status
      );
    }

    return response.json();
  }

  /**
   * Poll a job / fetch its result envelope (GET /v1/jobs/:trace_id)
   */
  async job(traceId: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/v1/jobs/${encodeURIComponent(traceId)}`,
      { signal: AbortSignal.timeout(this.requestTimeoutMs) }
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as any;
      throw new EvidenceOSUpstreamError(
        body.message || `No job '${traceId}' (unknown or expired)`,
        response.status
      );
    }
    return response.json();
  }
}

// Singleton instance for Command Center
export const evidenceos = new EvidenceOSClient(
  process.env.EVIDENCEOS_URL || "http://localhost:3002"
);

/**
 * NODE-GATE CLIENT
 * Integration module for AI-BI Intelligence Node-Gate
 * 
 * Wires the Command Center to the Node-Gate for epistemic classification
 * 
 * Copyright (c) 2025-2026 Damien Edward Featherstone / No-Gas-Labs™
 */

export interface InterventionRequest {
  input: string;
}

export interface InterventionResponse {
  original_signal: string;
  epistemic_tag: "V" | "P" | "S" | "M" | "A" | "UNCLASSIFIED";
  tag_name: string;
  confidence_score: number;
  dispatched_persona: "Prometheus" | "Courier" | "Bob" | "REJECTED";
  persona_role: string;
  classification_reasoning: string;
  timestamp: string;
  intervention_id: string;
  featherstonian_context: {
    event_type: string;
    ontology: string;
    jurisdiction: string;
    governor: string;
    narrative_state: string;
    myth_engine: {
      version: string;
      status: string;
      mode: string;
    };
    containment_warning?: {
      active: boolean;
      message: string;
      recommendation: string;
    };
    expansion_notice?: {
      active: boolean;
      message: string;
      recommendation: string;
    };
    bridge_notice?: {
      active: boolean;
      message: string;
      recommendation: string;
    };
  };
  persona_context: {
    name: string;
    archetype: string;
    domain: string;
    operational_mode: string;
    capabilities: string[];
    constraints: string[];
    mythic_reference: string;
    bob_factor?: number;
  };
  ip_protection: {
    license: string;
    copyright: string;
    ai_training_prohibited: boolean;
    commercial_use: string;
    attribution_required: boolean;
  };
  meta: {
    gate_version: string;
    processed_at: string;
    processing_mode: string;
    response_type: string;
  };
}

export interface BobFactorError {
  error: string;
  code: string;
  reason: string;
  bob_factor_level: number;
  recommendation: string;
  timestamp: string;
}

/**
 * Response from POST /v2/deliberate — multi-persona council deliberation.
 * `deliberation` is provider-shaped and carries its own honesty label
 * (deterministic vs model-backed) from the Node-Gate itself.
 */
export interface DeliberationResponse {
  input: string;
  council: {
    personas: string[];
    primary: string;
    mode: string;
    rationale: string;
  };
  deliberation: {
    [key: string]: any;
  };
  protocols: any;
  timestamp: string;
}

/** Error thrown when the Node-Gate v2 surface rejects or fails a request. */
export class NodeGateUpstreamError extends Error {
  public status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "NodeGateUpstreamError";
    this.status = status;
  }
}

export class NodeGateClient {
  // Public so the capability-health screen can report the configured
  // upstream URL without re-reading process.env separately.
  public baseUrl: string;
  private readonly healthTimeoutMs: number;
  private readonly requestTimeoutMs: number;

  constructor(baseUrl: string = "http://localhost:3001", healthTimeoutMs: number = 3000, requestTimeoutMs: number = 30000) {
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
   * Submit an intervention request to the Node-Gate
   */
  async intervene(input: string): Promise<InterventionResponse> {
    const response = await fetch(`${this.baseUrl}/v1/intervene`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });

    if (!response.ok) {
      const error: BobFactorError = await response.json();
      throw new NodeGateError(error);
    }

    return response.json();
  }

  /**
   * Check Node-Gate health status
   */
  async health(): Promise<{
    status: string;
    gate: string;
    version: string;
    narrative_state: string;
    timestamp: string;
  }> {
    const response = await fetch(`${this.baseUrl}/health`, {
      signal: AbortSignal.timeout(this.healthTimeoutMs),
    });
    if (!response.ok) {
      throw new NodeGateUpstreamError(
        `Node-Gate /health returned ${response.status}`,
        response.status
      );
    }
    return response.json();
  }

  /**
   * Get claim taxonomy documentation
   */
  async taxonomy(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/v1/taxonomy`, {
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });
    if (!response.ok) {
      throw new NodeGateUpstreamError(
        `Node-Gate /v1/taxonomy returned ${response.status}`,
        response.status
      );
    }
    return response.json();
  }

  /**
   * Submit an input for multi-persona council deliberation (Node-Gate v2).
   *
   * This is the REAL deliberation engine: the Node-Gate selects a council,
   * each persona produces a structured response via the configured provider
   * (or the explicitly-labeled deterministic fallback), challenge exchanges
   * are executed, and a synthesis is returned. The response labels its own
   * processing mode — no capability is claimed beyond what it reports.
   */
  async deliberate(
    input: string,
    persona_ids: string[] = [],
    max_personas: number = 5
  ): Promise<DeliberationResponse> {
    const response = await fetch(`${this.baseUrl}/v2/deliberate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input, persona_ids, max_personas }),
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as any;
      throw new NodeGateUpstreamError(
        body.message || body.error || "Node-Gate rejected the deliberation request",
        response.status
      );
    }

    return response.json();
  }
}

export class NodeGateError extends Error {
  public code: string;
  public bobFactorLevel: number;
  public recommendation: string;

  constructor(error: BobFactorError) {
    super(error.reason);
    this.name = "NodeGateError";
    this.code = error.code;
    this.bobFactorLevel = error.bob_factor_level;
    this.recommendation = error.recommendation;
  }
}

// Singleton instance for Command Center
export const nodeGate = new NodeGateClient(
  process.env.NODE_GATE_URL || "http://localhost:3001"
);

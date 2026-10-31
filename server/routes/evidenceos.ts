/**
 * EVIDENCEOS ROUTES
 * Express routes for EvidenceOS integration in Command Center
 *
 * Proxies analysis requests to the EvidenceOS HTTP API. The async mode's
 * status_url is rewritten to this proxy surface so clients poll through
 * the Command Center, never the internal EvidenceOS port.
 *
 * Copyright (c) 2025-2026 Damien Edward Featherstone / No-Gas-Labs™
 */

import { Router, Request, Response } from "express";
import { evidenceos, EvidenceOSUpstreamError } from "../evidenceos-client";

const router = Router();

/**
 * GET /api/evidenceos/health
 * Check EvidenceOS health status
 */
router.get("/health", async (_req: Request, res: Response) => {
  try {
    const health = await evidenceos.health();
    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: "UNAVAILABLE",
      message: "EvidenceOS is not responding",
    });
  }
});

/**
 * GET /api/evidenceos/schema
 * Get the provenance envelope schema documentation
 */
router.get("/schema", async (_req: Request, res: Response) => {
  try {
    const schema = await evidenceos.schema();
    res.json(schema);
  } catch (error) {
    res.status(503).json({
      error: "EVIDENCEOS_UNAVAILABLE",
      message: "Failed to retrieve schema",
    });
  }
});

/**
 * POST /api/evidenceos/analyze
 * Body: { owner: string, type?: "user"|"org", async?: boolean }
 *
 * Sync (default): returns the full provenance envelope.
 * Async (async:true): returns 202 { trace_id, status_url } — poll
 * GET /api/evidenceos/jobs/:trace_id through this proxy.
 */
router.post("/analyze", async (req: Request, res: Response) => {
  const { owner, type = "user", async: asyncMode = false } = req.body || {};

  if (typeof owner !== "string" || owner.trim().length === 0) {
    return res.status(400).json({
      error: "MISSING_OWNER",
      message: "owner field is required (non-empty GitHub user/org login)",
    });
  }
  if (type !== "user" && type !== "org") {
    return res.status(400).json({
      error: "INVALID_TYPE",
      message: "type must be 'user' or 'org'",
    });
  }
  if (typeof asyncMode !== "boolean") {
    return res.status(400).json({
      error: "INVALID_ASYNC",
      message: "async field must be a boolean",
    });
  }

  try {
    const result = await evidenceos.analyze(owner.trim(), type, asyncMode);

    // Async accepted: rewrite status_url to the proxy surface and pass 202.
    // A status URL without its trace ID cannot be polled safely.
    const accepted = result as any;
    if (accepted && typeof accepted.status_url === "string") {
      if (typeof accepted.trace_id !== "string" || accepted.trace_id.trim().length === 0) {
        return res.status(502).json({
          error: "EVIDENCEOS_INVALID_RESPONSE",
          message: "EvidenceOS async response did not include a valid trace_id",
        });
      }

      return res.status(202).json({
        ...accepted,
        status_url: `/api/evidenceos/jobs/${encodeURIComponent(accepted.trace_id)}`,
      });
    }

    return res.json(result);
  } catch (error) {
    if (error instanceof EvidenceOSUpstreamError) {
      // Pass through the upstream HTTP status (400/401/404/413/429/502…)
      const status =
        error.status >= 400 && error.status < 600 ? error.status : 502;
      return res.status(status).json({
        error: "EVIDENCEOS_UPSTREAM",
        message: error.message,
        upstream_status: error.status,
      });
    }

    console.error("EvidenceOS analyze error:", error);
    return res.status(500).json({
      error: "EVIDENCEOS_UNAVAILABLE",
      message: "Failed to connect to EvidenceOS",
    });
  }
});

/**
 * GET /api/evidenceos/jobs/:traceId
 * Poll job status / fetch result envelope (kept ~30 min after completion)
 */
router.get("/jobs/:traceId", async (req: Request, res: Response) => {
  try {
    const job = await evidenceos.job(req.params.traceId);
    res.json(job);
  } catch (error) {
    if (error instanceof EvidenceOSUpstreamError) {
      const status =
        error.status >= 400 && error.status < 600 ? error.status : 502;
      return res.status(status).json({
        error: "EVIDENCEOS_UPSTREAM",
        message: error.message,
        upstream_status: error.status,
      });
    }

    console.error("EvidenceOS job poll error:", error);
    return res.status(500).json({
      error: "EVIDENCEOS_UNAVAILABLE",
      message: "Failed to connect to EvidenceOS",
    });
  }
});

export default router;

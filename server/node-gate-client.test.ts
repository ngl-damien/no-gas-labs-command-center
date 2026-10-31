import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeGateClient, NodeGateUpstreamError } from "./node-gate-client";
import { EvidenceOSClient } from "./evidenceos-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NodeGateClient.taxonomy", () => {
  it("rejects a non-success response instead of returning its error body as taxonomy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ status: "OPERATIONAL", error: "temporarily unavailable" }),
      { status: 503, headers: { "content-type": "application/json" } }
    )));

    await expect(new NodeGateClient("http://node-gate").taxonomy())
      .rejects.toMatchObject({ name: "NodeGateUpstreamError", status: 503 });
  });

  it("returns taxonomy only after a successful HTTP response", async () => {
    const payload = { claims: ["verified", "plausible"] };
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify(payload),
      { status: 200, headers: { "content-type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new NodeGateClient("http://node-gate").taxonomy()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://node-gate/v1/taxonomy",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});

describe("NodeGateClient.health", () => {
  it("rejects a non-success HTTP response even when its body claims OPERATIONAL", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ status: "OPERATIONAL" }),
      { status: 503, headers: { "content-type": "application/json" } }
    )));

    await expect(new NodeGateClient("http://node-gate").health())
      .rejects.toBeInstanceOf(NodeGateUpstreamError);
  });

  it("returns health data only after a successful HTTP response", async () => {
    const payload = {
      status: "OPERATIONAL",
      gate: "node-gate",
      version: "test",
      narrative_state: "ready",
      timestamp: "2026-10-31T00:00:00.000Z"
    };
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify(payload),
      { status: 200, headers: { "content-type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new NodeGateClient("http://node-gate").health()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://node-gate/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});


function installHangingFetch() {
  let observedSignal: AbortSignal | null | undefined;
  const fetchMock = vi.fn((_input: unknown, init?: RequestInit) => {
    observedSignal = init?.signal;
    return new Promise<Response>((_resolve, reject) => {
      const signal = observedSignal;
      if (!signal) {
        reject(new Error("upstream request did not provide an abort signal"));
        return;
      }
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, getSignal: () => observedSignal };
}

describe("bounded upstream health probes", () => {
  it("aborts a stalled Node-Gate health request", async () => {
    const { fetchMock, getSignal } = installHangingFetch();

    await expect(new NodeGateClient("http://node-gate", 10).health())
      .rejects.toMatchObject({ name: "TimeoutError" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://node-gate/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(getSignal()?.aborted).toBe(true);
  });

  it("aborts a stalled EvidenceOS health request", async () => {
    const { fetchMock, getSignal } = installHangingFetch();

    await expect(new EvidenceOSClient("http://evidenceos", 10).health())
      .rejects.toMatchObject({ name: "TimeoutError" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://evidenceos/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(getSignal()?.aborted).toBe(true);
  });

  it("rejects unbounded or invalid health timeout configuration", () => {
    expect(() => new NodeGateClient("http://node-gate", 0)).toThrow("HEALTH_TIMEOUT_INVALID");
    expect(() => new EvidenceOSClient("http://evidenceos", 30001)).toThrow("HEALTH_TIMEOUT_INVALID");
  });
});


describe("bounded non-health upstream requests", () => {
  it("aborts every Node-Gate and EvidenceOS operation when the upstream stalls", async () => {
    const cases: Array<{ label: string; run: () => Promise<unknown>; url: string }> = [
      {
        label: "Node-Gate intervention",
        run: () => new NodeGateClient("http://node-gate", 3000, 10).intervene("bounded fixture"),
        url: "http://node-gate/v1/intervene",
      },
      {
        label: "Node-Gate taxonomy",
        run: () => new NodeGateClient("http://node-gate", 3000, 10).taxonomy(),
        url: "http://node-gate/v1/taxonomy",
      },
      {
        label: "Node-Gate deliberation",
        run: () => new NodeGateClient("http://node-gate", 3000, 10).deliberate("bounded fixture"),
        url: "http://node-gate/v2/deliberate",
      },
      {
        label: "EvidenceOS schema",
        run: () => new EvidenceOSClient("http://evidenceos", 3000, 10).schema(),
        url: "http://evidenceos/v1/schema",
      },
      {
        label: "EvidenceOS asynchronous analysis acceptance",
        run: () => new EvidenceOSClient("http://evidenceos", 3000, 10).analyze("damien", "user", true),
        url: "http://evidenceos/v1/analyze?async=1",
      },
      {
        label: "EvidenceOS job polling",
        run: () => new EvidenceOSClient("http://evidenceos", 3000, 10).job("trace-fixture"),
        url: "http://evidenceos/v1/jobs/trace-fixture",
      },
    ];

    for (const item of cases) {
      const { fetchMock, getSignal } = installHangingFetch();
      await expect(item.run(), item.label).rejects.toMatchObject({ name: "TimeoutError" });
      expect(fetchMock).toHaveBeenCalledWith(
        item.url,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(getSignal()?.aborted, item.label).toBe(true);
    }
  });

  it("rejects invalid non-health request timeout configuration", () => {
    expect(() => new NodeGateClient("http://node-gate", 3000, 0)).toThrow("REQUEST_TIMEOUT_INVALID");
    expect(() => new NodeGateClient("http://node-gate", 3000, 120001)).toThrow("REQUEST_TIMEOUT_INVALID");
    expect(() => new EvidenceOSClient("http://evidenceos", 3000, 0)).toThrow("REQUEST_TIMEOUT_INVALID");
    expect(() => new EvidenceOSClient("http://evidenceos", 3000, 120001)).toThrow("REQUEST_TIMEOUT_INVALID");
  });
});

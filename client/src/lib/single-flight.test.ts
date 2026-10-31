import { describe, expect, it } from "vitest";
import { createSingleFlightTask } from "./single-flight";

describe("single-flight async task", () => {
  it("skips overlapping calls and permits a later poll after settlement", async () => {
    let calls = 0;
    let release: ((value: string) => void) | undefined;
    const run = createSingleFlightTask(() => {
      calls += 1;
      return new Promise<string>((resolve) => { release = resolve; });
    });

    const first = run();
    if (first === null) throw new Error("first call should start");
    expect(run()).toBeNull();
    expect(calls).toBe(1);

    release?.("first result");
    await expect(first).resolves.toBe("first result");

    const second = run();
    if (second === null) throw new Error("second call should start after settlement");
    expect(calls).toBe(2);
    release?.("second result");
    await expect(second).resolves.toBe("second result");
  });

  it("releases the in-flight guard after a rejected request", async () => {
    let calls = 0;
    const run = createSingleFlightTask(async () => {
      calls += 1;
      if (calls === 1) throw new Error("probe failed");
      return "recovered";
    });

    await expect(run()).rejects.toThrow("probe failed");
    await expect(run()).resolves.toBe("recovered");
    expect(calls).toBe(2);
  });
});

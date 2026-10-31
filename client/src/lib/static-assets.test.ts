import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Command Center static assets", () => {
  it("ships the grid overlay referenced by the home page", async () => {
    const asset = await readFile(new URL("../../public/grid-pattern.svg", import.meta.url), "utf8");
    expect(asset).toMatch(/^<svg\b/);
    expect(asset).toContain('viewBox="0 0 40 40"');
    expect(asset).toContain('stroke="#C5CDD4"');
  });
});

import { describe, expect, it } from "vitest";
import { commandCenterApiTarget, commandCenterPort } from "./dev-config.mjs";

describe("Command Center development API routing", () => {
  it("defaults to the Express API port, not the Node-Gate upstream", () => {
    expect(commandCenterPort({ NODE_GATE_URL: "http://127.0.0.1:3001" })).toBe(3003);
    expect(commandCenterApiTarget({
      NODE_GATE_URL: "http://127.0.0.1:3001",
      EVIDENCEOS_URL: "http://127.0.0.1:3002"
    })).toBe("http://127.0.0.1:3003");
  });

  it("uses a validated custom Command Center port when no target URL is supplied", () => {
    expect(commandCenterPort({ COMMAND_CENTER_PORT: "4317" })).toBe(4317);
    expect(commandCenterApiTarget({ COMMAND_CENTER_PORT: "4317" })).toBe("http://127.0.0.1:4317");
  });

  it("prefers an explicit API origin and strips its trailing slash", () => {
    expect(commandCenterApiTarget({
      COMMAND_CENTER_PORT: "4317",
      COMMAND_CENTER_API_URL: "https://command-center.internal:9443/"
    })).toBe("https://command-center.internal:9443");
  });

  it.each(["0", "-1", "65536", "abc", "3e3"])("rejects invalid port %s", value => {
    expect(() => commandCenterPort({ COMMAND_CENTER_PORT: value })).toThrow("COMMAND_CENTER_PORT_INVALID");
  });


  it("rejects URL credentials without embedding a credentialed URI literal", () => {
    const target = new URL("http://localhost:3003");
    target.username = "example";
    target.password = "example";
    expect(() => commandCenterApiTarget({
      COMMAND_CENTER_API_URL: target.toString()
    })).toThrow("COMMAND_CENTER_API_URL_INVALID");
  });

  it.each([
    "file:///tmp/command-center",
    "http://localhost:3003/api",
    "http://localhost:3003?token=secret",
    "http://localhost:3003#fragment"
  ])("rejects unsafe or non-origin API target %s", value => {
    expect(() => commandCenterApiTarget({ COMMAND_CENTER_API_URL: value })).toThrow("COMMAND_CENTER_API_URL_INVALID");
  });
});

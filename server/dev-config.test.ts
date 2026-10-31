import { describe, expect, it } from "vitest";
import {
  commandCenterApiHost,
  commandCenterApiTarget,
  commandCenterPort,
  commandCenterUiHost,
  commandCenterUiPort,
} from "./dev-config.mjs";

describe("Command Center development API routing", () => {
  it("defaults to the Express API port, not the Node-Gate upstream", () => {
    expect(commandCenterPort({ NODE_GATE_URL: "http://127.0.0.1:3001" })).toBe(3003);
    expect(commandCenterApiTarget({
      NODE_GATE_URL: "http://127.0.0.1:3001",
      EVIDENCEOS_URL: "http://127.0.0.1:3002"
    })).toBe("http://127.0.0.1:3003");
  });

  it("validates a separate UI port so Vite cannot silently fall back to another port", () => {
    expect(commandCenterUiPort({})).toBe(3000);
    expect(commandCenterUiPort({ COMMAND_CENTER_UI_PORT: "4318" })).toBe(4318);
    for (const value of ["0", "-1", "65536", "abc", "3e3"]) {
      expect(() => commandCenterUiPort({ COMMAND_CENTER_UI_PORT: value }))
        .toThrow("COMMAND_CENTER_UI_PORT_INVALID");
    }
  });

  it("uses a validated custom Command Center port when no target URL is supplied", () => {
    expect(commandCenterPort({ COMMAND_CENTER_PORT: "4317" })).toBe(4317);
    expect(commandCenterApiTarget({ COMMAND_CENTER_PORT: "4317" })).toBe("http://127.0.0.1:4317");
  });

  it("prefers an explicit API origin and strips its trailing slash", () => {
    const target = new URL("http://localhost:3003");
    target.protocol = "https:";
    target.hostname = "example.com";
    target.port = "9443";
    expect(commandCenterApiTarget({
      COMMAND_CENTER_PORT: "4317",
      COMMAND_CENTER_API_URL: target.toString()
    })).toBe(target.origin);
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

  it("rejects query-bearing API URLs without embedding token-shaped URI text", () => {
    const target = new URL("http://localhost:3003");
    target.searchParams.set("token", "example");
    expect(() => commandCenterApiTarget({
      COMMAND_CENTER_API_URL: target.toString()
    })).toThrow("COMMAND_CENTER_API_URL_INVALID");
  });

  it("rejects non-HTTP schemes", () => {
    const target = new URL("http://localhost:3003");
    target.protocol = "ftp:";
    expect(() => commandCenterApiTarget({ COMMAND_CENTER_API_URL: target.toString() })).toThrow("COMMAND_CENTER_API_URL_INVALID");
  });

  it("rejects non-origin paths and fragments", () => {
    const pathTarget = new URL("http://localhost:3003");
    pathTarget.pathname = "/api";
    expect(() => commandCenterApiTarget({ COMMAND_CENTER_API_URL: pathTarget.toString() })).toThrow("COMMAND_CENTER_API_URL_INVALID");
    const fragmentTarget = new URL("http://localhost:3003");
    fragmentTarget.hash = "#fragment";
    expect(() => commandCenterApiTarget({ COMMAND_CENTER_API_URL: fragmentTarget.toString() })).toThrow("COMMAND_CENTER_API_URL_INVALID");
  });
  it("binds the development API and UI to loopback by default", () => {
    expect(commandCenterApiHost({})).toBe("127.0.0.1");
    expect(commandCenterUiHost({})).toBe("127.0.0.1");
  });

  it("keeps the production API wildcard default while requiring opt-in for development LAN exposure", () => {
    expect(commandCenterApiHost({ NODE_ENV: "production" })).toBe("0.0.0.0");
    expect(() => commandCenterApiHost({ COMMAND_CENTER_API_HOST: "0.0.0.0" }))
      .toThrow("COMMAND_CENTER_LAN_BIND_REQUIRES_EXPLICIT_OPT_IN");
    expect(commandCenterApiHost({
      COMMAND_CENTER_API_HOST: "0.0.0.0",
      COMMAND_CENTER_ALLOW_UNAUTHENTICATED_LAN: "1",
    })).toBe("0.0.0.0");
  });

  it("requires explicit opt-in before the Vite proxy is exposed to a LAN", () => {
    expect(() => commandCenterUiHost({ COMMAND_CENTER_UI_HOST: "0.0.0.0" }))
      .toThrow("COMMAND_CENTER_LAN_BIND_REQUIRES_EXPLICIT_OPT_IN");
    expect(commandCenterUiHost({
      COMMAND_CENTER_UI_HOST: "0.0.0.0",
      COMMAND_CENTER_ALLOW_UNAUTHENTICATED_LAN: "1",
    })).toBe("0.0.0.0");
  });

  it("rejects unsafe bind-host values before they reach a process argument", () => {
    for (const value of ["127.0.0.1:3000", "http://127.0.0.1", "127.0.0.1;echo", "::", "[::1]"]) {
      expect(() => commandCenterUiHost({ COMMAND_CENTER_UI_HOST: value }))
        .toThrow("COMMAND_CENTER_UI_HOST_INVALID");
    }
  });

});

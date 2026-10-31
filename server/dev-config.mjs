const DEFAULT_COMMAND_CENTER_PORT = 3003;
const DEFAULT_COMMAND_CENTER_UI_PORT = 3000;
const DEFAULT_LOOPBACK_HOST = "127.0.0.1";
const DEFAULT_PRODUCTION_HOST = "0.0.0.0";
const ALLOWED_BIND_HOSTS = new Set([DEFAULT_LOOPBACK_HOST, "localhost", DEFAULT_PRODUCTION_HOST]);

function configuredHost(raw, fallback, errorCode) {
  const value = raw === undefined || (typeof raw === "string" && raw.trim() === "")
    ? fallback
    : raw;
  if (typeof value !== "string" || value !== value.trim() || !ALLOWED_BIND_HOSTS.has(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function configuredPort(raw, fallback, errorCode) {
  const value = raw === undefined || (typeof raw === "string" && raw.trim() === "")
    ? String(fallback)
    : raw;
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error(errorCode);
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error(errorCode);
  return port;
}

export function commandCenterPort(env = process.env) {
  return configuredPort(env.COMMAND_CENTER_PORT, DEFAULT_COMMAND_CENTER_PORT, "COMMAND_CENTER_PORT_INVALID");
}

export function commandCenterUiPort(env = process.env) {
  return configuredPort(env.COMMAND_CENTER_UI_PORT, DEFAULT_COMMAND_CENTER_UI_PORT, "COMMAND_CENTER_UI_PORT_INVALID");
}

export function commandCenterApiHost(env = process.env) {
  const raw = env.COMMAND_CENTER_API_HOST ?? env.HOST;
  const fallback = env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_HOST : DEFAULT_LOOPBACK_HOST;
  const host = configuredHost(raw, fallback, "COMMAND_CENTER_API_HOST_INVALID");
  if (host === DEFAULT_PRODUCTION_HOST &&
      env.NODE_ENV !== "production" &&
      env.COMMAND_CENTER_ALLOW_UNAUTHENTICATED_LAN !== "1") {
    throw new Error("COMMAND_CENTER_LAN_BIND_REQUIRES_EXPLICIT_OPT_IN");
  }
  return host;
}

export function commandCenterUiHost(env = process.env) {
  const host = configuredHost(env.COMMAND_CENTER_UI_HOST, DEFAULT_LOOPBACK_HOST, "COMMAND_CENTER_UI_HOST_INVALID");
  if (host === DEFAULT_PRODUCTION_HOST && env.COMMAND_CENTER_ALLOW_UNAUTHENTICATED_LAN !== "1") {
    throw new Error("COMMAND_CENTER_LAN_BIND_REQUIRES_EXPLICIT_OPT_IN");
  }
  return host;
}

export function commandCenterApiTarget(env = process.env) {
  const raw = env.COMMAND_CENTER_API_URL;
  if (raw === undefined || raw.trim() === "") {
    return `http://127.0.0.1:${commandCenterPort(env)}`;
  }

  let url;
  try { url = new URL(raw); }
  catch { throw new Error("COMMAND_CENTER_API_URL_INVALID"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new Error("COMMAND_CENTER_API_URL_INVALID");
  }
  return url.origin;
}

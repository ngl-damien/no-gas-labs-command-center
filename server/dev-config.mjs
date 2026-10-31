const DEFAULT_COMMAND_CENTER_PORT = 3003;
const DEFAULT_COMMAND_CENTER_UI_PORT = 3000;

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

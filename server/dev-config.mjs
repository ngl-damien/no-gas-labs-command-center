const DEFAULT_COMMAND_CENTER_PORT = 3003;

export function commandCenterPort(env = process.env) {
  const raw = env.COMMAND_CENTER_PORT;
  const value = raw === undefined || raw.trim() === "" ? String(DEFAULT_COMMAND_CENTER_PORT) : raw;
  if (!/^\d+$/.test(value)) throw new Error("COMMAND_CENTER_PORT_INVALID");
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("COMMAND_CENTER_PORT_INVALID");
  }
  return port;
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

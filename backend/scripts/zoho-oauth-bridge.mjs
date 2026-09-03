#!/usr/bin/env node
/**
 * Zoho OAuth bridge for local development.
 *
 * Problem: the Zoho app's registered redirect URI points at the production backend
 * (e.g. https://synervo-api.candexai.co.in/api/v1/integrations/zoho/callback) and you cannot
 * add a localhost redirect in the Zoho API console.
 *
 * Solution: run a local HTTPS server that impersonates that hostname *inside a dedicated Chrome
 * window only* (Chrome's --host-resolver-rules flag maps the production host to 127.0.0.1:8443).
 * When Zoho redirects the browser to the production URL, Chrome hits this bridge instead, which
 * forwards the callback (code + state) to the local backend. The backend exchanges the code using
 * the same redirect_uri string, stores the tokens in MongoDB and redirects to the local frontend.
 *
 * Nothing on the network is changed; normal Chrome windows are unaffected.
 *
 * Usage:  npm run zoho:bridge            (from backend/ or repo root)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { spawnSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = loadEnv(path.join(__dirname, "..", ".env"));

const REDIRECT_URI = env.ZOHO_REDIRECT_URI || "";
const BACKEND = (env.BRIDGE_BACKEND_URL || `http://localhost:${env.PORT || 5001}`).replace(/\/$/, "");
const FRONTEND = (env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const BRIDGE_PORT = Number(env.BRIDGE_PORT || 8443);

if (!/^https:\/\//.test(REDIRECT_URI)) {
  console.error("ZOHO_REDIRECT_URI in backend/.env must be an https URL (the one registered in the Zoho API console).");
  process.exit(1);
}
const target = new URL(REDIRECT_URI);
const HOST = target.hostname;
if (/^(localhost|127\.0\.0\.1)$/.test(HOST)) {
  console.log(`ZOHO_REDIRECT_URI already points at ${HOST}; no bridge needed. Just open ${FRONTEND}/integrations.`);
  process.exit(0);
}

// ---- self-signed certificate for the impersonated host (cached under ~/.matrix) ----
const certDir = path.join(os.homedir(), ".matrix", "zoho-bridge");
fs.mkdirSync(certDir, { recursive: true });
const keyPath = path.join(certDir, `${HOST}.key`);
const certPath = path.join(certDir, `${HOST}.crt`);
if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  const r = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyPath, "-out", certPath, "-days", "90", "-subj", `/CN=${HOST}`, "-addext", `subjectAltName=DNS:${HOST}`], { stdio: "pipe" });
  if (r.status !== 0) {
    console.error("openssl failed to create a self-signed certificate:", r.stderr?.toString());
    process.exit(1);
  }
}

// ---- HTTPS bridge → local backend ----
const server = https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, (req, res) => {
  const url = new URL(req.url || "/", `https://${HOST}`);
  const isCallback = url.pathname === target.pathname;
  console.log(`[bridge] ${req.method} ${url.pathname}${url.search ? redact(url.search) : ""}${isCallback ? "  ← Zoho callback, forwarding to backend" : ""}`);

  const upstream = new URL(url.pathname + url.search, BACKEND);
  const proxy = http.request(
    upstream,
    { method: req.method, headers: { ...req.headers, host: upstream.host, "x-forwarded-host": HOST, "x-forwarded-proto": "https" } },
    (up) => {
      const headers = { ...up.headers };
      res.writeHead(up.statusCode || 502, headers);
      up.pipe(res);
      if (isCallback && headers.location) console.log(`[bridge] backend answered ${up.statusCode} → ${headers.location}`);
    }
  );
  proxy.on("error", (err) => {
    console.error(`[bridge] cannot reach backend at ${BACKEND}: ${err.message}`);
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`Matrix backend is not reachable at ${BACKEND}. Start it with "npm run dev" and retry.`);
  });
  req.pipe(proxy);
});

server.listen(BRIDGE_PORT, "127.0.0.1", () => {
  console.log(`
  Zoho OAuth bridge
  ─────────────────
  Impersonating : https://${HOST}  →  ${BACKEND}
  Listening on  : https://127.0.0.1:${BRIDGE_PORT}  (self-signed cert, only trusted by the Chrome window below)
  Frontend      : ${FRONTEND}/integrations
`);
  if (process.env.BRIDGE_NO_BROWSER === "1" || process.argv.includes("--no-browser")) {
    console.log("  (--no-browser) not launching Chrome. Map the host yourself, e.g. curl --resolve " + HOST + ":" + BRIDGE_PORT + ":127.0.0.1 -k https://" + HOST + ":" + BRIDGE_PORT + "/health");
    return;
  }
  launchChrome();
});

function launchChrome() {
  const profile = path.join(os.tmpdir(), "matrix-zoho-chrome");
  const args = [
    `--user-data-dir=${profile}`,
    `--host-resolver-rules=MAP ${HOST} 127.0.0.1:${BRIDGE_PORT}`,
    "--ignore-certificate-errors",
    "--no-first-run",
    "--no-default-browser-check",
    `--app-name=Matrix Zoho connect`,
    `${FRONTEND}/integrations`,
  ];
  const candidates =
    process.platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"]
      : ["google-chrome", "chromium", "chromium-browser"];
  const bin = candidates.find((c) => (c.startsWith("/") ? fs.existsSync(c) : true));
  if (!bin) {
    console.log(`Could not find Chrome. Launch a Chromium browser manually with:\n  --host-resolver-rules="MAP ${HOST} 127.0.0.1:${BRIDGE_PORT}" --ignore-certificate-errors --user-data-dir=${profile} ${FRONTEND}/integrations`);
    return;
  }
  console.log(`  Opening a dedicated Chrome window (${path.basename(bin)}). Complete "Connect Zoho CRM" there.\n  Keep this process running until you land back on ${FRONTEND}/integrations?provider=zoho&status=connected\n`);
  const child = spawn(bin, args, { detached: true, stdio: "ignore" });
  child.unref();
}

function loadEnv(file) {
  const out = { ...process.env };
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    if (!(m[1] in process.env)) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function redact(search) {
  return search.replace(/(code=)[^&]+/, "$1***");
}

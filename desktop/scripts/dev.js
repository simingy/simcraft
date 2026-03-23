const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

const ROOT = path.join(__dirname, "..", "..");
const BACKEND_DIR = path.join(ROOT, "backend");
const FRONTEND_DIR = path.join(ROOT, "frontend");

const ext = process.platform === "win32" ? ".exe" : "";
const serverBinary = path.join(BACKEND_DIR, "target", "debug", `simhammer-server${ext}`);

function findNewestMtime(dir, extension) {
  let newest = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "target" && entry.name !== "node_modules") {
      newest = Math.max(newest, findNewestMtime(full, extension));
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      newest = Math.max(newest, fs.statSync(full).mtimeMs);
    }
  }
  return newest;
}

function buildBackend() {
  console.log("[dev] Building Rust backend...");
  execSync("cargo build -p simhammer-server --features desktop", {
    cwd: BACKEND_DIR,
    stdio: "inherit",
  });
  console.log("[dev] Backend built.");
}

function waitForUrl(url, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      if (Date.now() - start > timeout) {
        return reject(new Error(`Timed out waiting for ${url}`));
      }
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) resolve();
        else setTimeout(check, 300);
      });
      req.on("error", () => setTimeout(check, 300));
      req.setTimeout(1000, () => {
        req.destroy();
        setTimeout(check, 300);
      });
    }
    check();
  });
}

function ensureResources() {
  const dataDir = path.join(BACKEND_DIR, "resources", "data");
  const simcDir = path.join(BACKEND_DIR, "resources", "simc");
  const simcBinary = path.join(simcDir, process.platform === "win32" ? "simc.exe" : "simc");
  const metadataFile = path.join(dataDir, "metadata.json");

  if (fs.existsSync(simcBinary) && fs.existsSync(metadataFile)) {
    console.log("[dev] Resources up to date.");
    return;
  }

  console.log("[dev] Resources missing — fetching via Docker...");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(simcDir, { recursive: true });
  execSync("docker compose --profile desktop up resources --build", {
    cwd: ROOT,
    stdio: "inherit",
  });
}

async function main() {
  // 0. Ensure game data and simc binary exist
  ensureResources();

  // 1. Build backend if binary doesn't exist or any source changed
  if (!fs.existsSync(serverBinary)) {
    buildBackend();
  } else {
    // Rebuild if any .rs source file is newer than the binary
    try {
      const binaryMtime = fs.statSync(serverBinary).mtimeMs;
      const sourceChanged = findNewestMtime(BACKEND_DIR, ".rs") > binaryMtime
        || findNewestMtime(BACKEND_DIR, ".toml") > binaryMtime;
      if (sourceChanged) {
        buildBackend();
      } else {
        console.log("[dev] Backend binary up to date.");
      }
    } catch {
      buildBackend();
    }
  }

  // 2. Start Next.js dev server on a fixed port
  const FRONTEND_PORT = 3000;
  console.log(`[dev] Starting Next.js dev server on port ${FRONTEND_PORT}...`);
  const frontend = spawn("npx", ["next", "dev", "--port", String(FRONTEND_PORT)], {
    cwd: FRONTEND_DIR,
    stdio: "inherit",
    shell: true,
  });

  // 3. Wait for frontend to be ready
  console.log(`[dev] Waiting for frontend (localhost:${FRONTEND_PORT})...`);
  try {
    await waitForUrl(`http://localhost:${FRONTEND_PORT}`);
  } catch {
    console.error("[dev] Frontend did not start in time.");
    frontend.kill();
    process.exit(1);
  }
  console.log("[dev] Frontend ready.");

  // 4. Launch Electron
  console.log("[dev] Starting Electron...");
  const electronPath = require("electron");
  const electron = spawn(electronPath, [path.join(__dirname, "..")], {
    stdio: "inherit",
    env: process.env,
  });

  electron.on("exit", (code) => {
    console.log("[dev] Electron exited.");
    frontend.kill();
    process.exit(code ?? 0);
  });

  // Clean up on ctrl+c
  process.on("SIGINT", () => {
    electron.kill();
    frontend.kill();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    electron.kill();
    frontend.kill();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

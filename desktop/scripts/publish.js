const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Load .env.local from repo root
const envFile = path.join(__dirname, "..", "..", ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      const key = trimmed.slice(0, eq);
      const val = trimmed.slice(eq + 1);
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

if (!process.env.GH_TOKEN) {
  console.error("GH_TOKEN not set. Add it to .env.local or set it as an environment variable.");
  process.exit(1);
}

console.log("Building frontend...");
execSync("npm run build:frontend", { cwd: path.join(__dirname, ".."), stdio: "inherit" });

console.log("Building backend...");
execSync("npm run build:backend", { cwd: path.join(__dirname, ".."), stdio: "inherit" });

console.log("Publishing to GitHub...");
execSync("npx electron-builder --publish always", {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
  env: process.env,
});

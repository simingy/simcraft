const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const BACKEND_DIR = path.join(__dirname, "..", "..", "backend");
const SIMC_DIR = path.join(BACKEND_DIR, "resources", "simc");
const SIMC_BINARY = path.join(SIMC_DIR, process.platform === "win32" ? "simc.exe" : "simc");
const SIMC_VERSION = process.env.SIMC_VERSION || "HEAD";

function main() {
  if (fs.existsSync(SIMC_BINARY)) {
    console.log(`[build-simc] ${path.basename(SIMC_BINARY)} already exists. Delete it to rebuild.`);
    return;
  }

  fs.mkdirSync(SIMC_DIR, { recursive: true });

  // Use a unique temp dir to avoid stale lock conflicts
  const SIMC_SRC = path.join(os.tmpdir(), `simc-build-${Date.now()}`);

  console.log("[build-simc] Cloning SimulationCraft...");
  execSync(`git clone --depth 1 https://github.com/simulationcraft/simc.git "${SIMC_SRC}"`, {
    stdio: "inherit",
  });

  if (SIMC_VERSION !== "HEAD") {
    console.log(`[build-simc] Checking out ${SIMC_VERSION}...`);
    execSync(`git fetch --depth 1 origin ${SIMC_VERSION} && git checkout FETCH_HEAD`, {
      cwd: SIMC_SRC,
      stdio: "inherit",
    });
  }

  // Build with CMake
  const buildDir = path.join(SIMC_SRC, "build");

  if (process.platform === "win32") {
    console.log("[build-simc] Configuring with CMake (MSVC)...");
    execSync([
      `cmake -B build -G "Visual Studio 17 2022" -A x64`,
      `-DBUILD_GUI=OFF -DBUILD_TESTING=OFF`,
      `-DCMAKE_CXX_FLAGS_RELEASE="/O2 /Ob3 /GL /fp:fast /DNDEBUG"`,
      `-DCMAKE_EXE_LINKER_FLAGS_RELEASE="/LTCG"`,
    ].join(" "),
      { cwd: SIMC_SRC, stdio: "inherit" }
    );

    console.log("[build-simc] Building simc.exe (Release, optimized)...");
    execSync(`cmake --build build --config Release --target simc`, {
      cwd: SIMC_SRC,
      stdio: "inherit",
    });

    const built = path.join(buildDir, "Release", "simc.exe");
    if (!fs.existsSync(built)) {
      console.error("[build-simc] Build failed — simc.exe not found at", built);
      process.exit(1);
    }

    fs.copyFileSync(built, SIMC_BINARY);
  } else {
    console.log("[build-simc] Building simc (make)...");
    execSync(
      `make LTO=1 NO_DEBUG=1 -j${os.cpus().length} OPENSSL=0 OPTS="-ffast-math -fomit-frame-pointer"`,
      { cwd: path.join(SIMC_SRC, "engine"), stdio: "inherit" }
    );

    const built = path.join(SIMC_SRC, "engine", "simc");
    if (!fs.existsSync(built)) {
      console.error("[build-simc] Build failed — simc not found at", built);
      process.exit(1);
    }

    fs.copyFileSync(built, SIMC_BINARY);
  }

  console.log(`[build-simc] Installed ${path.basename(SIMC_BINARY)} to ${SIMC_DIR}`);

  // Cleanup — best effort, Windows may hold locks on build artifacts
  try {
    fs.rmSync(SIMC_SRC, { recursive: true, force: true });
  } catch {
    console.log(`[build-simc] Note: could not clean ${SIMC_SRC}, safe to delete manually.`);
  }
}

main();

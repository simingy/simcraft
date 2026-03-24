#!/bin/bash
set -e

DATA_DIR="/app/resources/data"
DATA_FULL_DIR="/app/resources/data_full"
SIMC_DIR="/app/resources/simc_repo"
SIMC_BIN="/usr/local/bin/simc"

mkdir -p "$DATA_FULL_DIR"
mkdir -p "$SIMC_DIR"

echo "Fetching latest Raidbots game data..."
curl -sL -o "$DATA_FULL_DIR/metadata.json" https://www.raidbots.com/static/data/live/metadata.json
for f in $(jq -r '.files[]' "$DATA_FULL_DIR/metadata.json"); do
    echo "Downloading $f..."
    curl -sL -o "$DATA_FULL_DIR/$f" "https://www.raidbots.com/static/data/live/$f"
done

# Copy in the season config from the baked-in default, then compact
cp /app/default_season_config.json "$DATA_FULL_DIR/season-config.json"

echo "Compacting game data..."
node /app/compact-data.js "$DATA_FULL_DIR" "$DATA_DIR"

echo "Checking for SimulationCraft updates..."
BUILD_NEEDED=false

# Guard: if .git exists but the repo is unhealthy (e.g. interrupted clone), wipe and re-clone
if [ -d "$SIMC_DIR/.git" ] && ! git -C "$SIMC_DIR" rev-parse HEAD > /dev/null 2>&1; then
    echo "SimC repo is broken, removing and re-cloning..."
    rm -rf "$SIMC_DIR"
fi

if [ ! -d "$SIMC_DIR/.git" ]; then
    echo "Cloning SimulationCraft (shallow, midnight branch)..."
    git clone --depth 1 --branch midnight https://github.com/simulationcraft/simc.git "$SIMC_DIR"
    BUILD_NEEDED=true
else
    cd "$SIMC_DIR"
    echo "Fetching latest changes (shallow, midnight branch)..."
    git fetch --depth 1 origin midnight

    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse FETCH_HEAD)

    if [ "$LOCAL" != "$REMOTE" ]; then
        echo "Updates found. Resetting to latest commit..."
        git reset --hard FETCH_HEAD
        BUILD_NEEDED=true
    elif [ ! -f "$SIMC_BIN" ]; then
        echo "Binary missing, rebuilding..."
        BUILD_NEEDED=true
    else
        echo "SimulationCraft is up to date."
    fi
fi

if [ "$BUILD_NEEDED" = "true" ]; then
    echo "Compiling SimulationCraft (this may take a few minutes)..."
    cd "$SIMC_DIR/engine"
    make clean
    make optimized SC_NO_NETWORKING=1 -j$(nproc)
    cp simc "$SIMC_BIN"
    echo "SimulationCraft compiled successfully."
fi

export SIMC_PATH="$SIMC_BIN"
export DATA_DIR="$DATA_DIR"

echo "Starting SimHammer Server..."
exec "$@"

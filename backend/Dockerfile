FROM python:3.11-slim

WORKDIR /app

# Install build dependencies for simc
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libcurl4-openssl-dev \
    git \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Build SimulationCraft from source
RUN git clone --depth 1 https://github.com/simulationcraft/simc.git /tmp/simc \
    && cd /tmp/simc/engine \
    && make -j$(nproc) OPENSSL=0 \
    && cp simc /usr/local/bin/simc \
    && rm -rf /tmp/simc

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Download Raidbots game data files
RUN mkdir -p data && cd data \
    && curl -sL -o enchantments.json https://www.raidbots.com/static/data/live/enchantments.json \
    && curl -sL -o bonuses.json https://www.raidbots.com/static/data/live/bonuses.json \
    && curl -sL -o equippable-items-full.json https://www.raidbots.com/static/data/live/equippable-items-full.json \
    && curl -sL -o item-curves.json https://www.raidbots.com/static/data/live/item-curves.json \
    && curl -sL -o item-names.json https://www.raidbots.com/static/data/live/item-names.json

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

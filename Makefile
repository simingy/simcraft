# SimHammer Makefile

COMPOSE_DEV = docker-compose.dev.yml

.PHONY: help serve stop rebuild logs clean build-standalone run-standalone

help:
	@echo "SimHammer Commands:"
	@echo "  make serve            - Start the development environment (Docker)"
	@echo "  make stop             - Stop the development environment"
	@echo "  make rebuild          - Rebuild containers and start"
	@echo "  make logs             - Show real-time logs from all containers"
	@echo "  make clean            - Stop environment and remove all volumes (reset database)"
	@echo "  make build-standalone - Build a single self-contained Docker image"
	@echo "  make run-standalone   - Run the standalone image with persistent volumes"

serve:
	docker compose -f $(COMPOSE_DEV) up

stop:
	docker compose -f $(COMPOSE_DEV) down

rebuild:
	docker compose -f $(COMPOSE_DEV) up --build

logs:
	docker compose -f $(COMPOSE_DEV) logs -f

clean:
	docker compose -f $(COMPOSE_DEV) down -v

build-standalone:
	docker build -t simhammer-standalone -f Dockerfile.standalone .

run-standalone:
	docker run -it -p 8000:8000 \
		-v simhammer-data:/app/resources/data \
		-v simhammer-data-full:/app/resources/data_full \
		-v simhammer-simc:/app/resources/simc \
		-v simhammer-db:/app/db \
		simhammer-standalone

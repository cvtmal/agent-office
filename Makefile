-include .lane.env

PORT ?= $(or $(HARNESS_PORT),4477)
BIN := node_modules/.bin
DEPS := node_modules/.package-lock.json

.PHONY: install dev build start stop lint test e2e replay fixtures

$(DEPS): package-lock.json
	npm ci
	@touch $@

install:
	npm ci

dev: $(DEPS)
	bin/agent-office --dev --port $(PORT)

build: $(DEPS)
	$(BIN)/tsc -p tsconfig.build.json && $(BIN)/vite build

start: build
	bin/agent-office --port $(PORT)

stop:
	@pids=$$(lsof -ti tcp:$(PORT) -sTCP:LISTEN); if [ -n "$$pids" ]; then kill $$pids; echo "stopped port $(PORT)"; else echo "nothing on port $(PORT)"; fi

lint: $(DEPS)
	$(BIN)/eslint .
	$(BIN)/tsc -p tsconfig.shared.json
	$(BIN)/tsc -p tsconfig.node.json
	$(BIN)/tsc -p tsconfig.client.json

test: $(DEPS)
	$(BIN)/vitest run

e2e: $(DEPS)
	$(BIN)/playwright install chromium && PORT=$(PORT) $(BIN)/playwright test

replay: $(DEPS)
	bin/agent-office --replay $(DIR) --port $(PORT)

# Regenerate fixtures/snapshots/sample.json from fixtures/gen/sample.ts.
fixtures: $(DEPS)
	$(BIN)/tsx fixtures/gen/sample.ts

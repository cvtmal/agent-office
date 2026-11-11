-include .lane.env

PORT ?= $(or $(HARNESS_PORT),4477)
BIN := node_modules/.bin
DEPS := node_modules/.package-lock.json

.PHONY: install dev build start stop lint test e2e replay fixtures compare-ctx

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

# Regenerate fixtures/snapshots/sample.json (gen/sample.ts) and fixtures/transcripts/ (gen/transcripts.ts).
# Fixture generators: the sample, the transcript unit cases and the replay sets (plan Phase 5, 7).
fixtures: $(DEPS)
	$(BIN)/tsx fixtures/gen/sample.ts
	$(BIN)/tsx fixtures/gen/transcripts.ts
	$(BIN)/tsx fixtures/gen/replay.ts

# The reader's characters of this repo against bin/harness/ctx --json (plan Phase 8; not a gate).
compare-ctx: $(DEPS)
	$(BIN)/tsx src/server/compare-ctx.ts

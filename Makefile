-include .lane.env

PORT ?= $(or $(HARNESS_PORT),4477)
SPEED ?= 1
BIN := node_modules/.bin
DEPS := node_modules/.package-lock.json

.PHONY: install dev build start stop lint test e2e replay fixtures compare-ctx sprites bench-live bench-mem

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

# Play a replay set: make replay DIR=fixtures/replay/harness [SPEED=10] (the copy goes to var/replay/).
replay: $(DEPS)
	bin/agent-office --replay $(DIR) --speed $(SPEED) --port $(PORT)

# Regenerate fixtures/snapshots/sample.json (gen/sample.ts) and fixtures/transcripts/ (gen/transcripts.ts).
# Fixture generators: the sample, the transcript unit cases and the replay sets (plan Phase 5, 7).
fixtures: $(DEPS)
	$(BIN)/tsx fixtures/gen/sample.ts
	$(BIN)/tsx fixtures/gen/transcripts.ts
	$(BIN)/tsx fixtures/gen/replay.ts

# The reader's characters of this repo against bin/harness/ctx --json (plan Phase 8; not a gate).
compare-ctx: $(DEPS)
	$(BIN)/tsx src/server/compare-ctx.ts

# Write a 4x PNG preview sheet per sprite family (and the palette) to var/sprites/.
sprites: $(DEPS)
	SPRITE_PNG=1 $(BIN)/vitest run test/sprite-preview.test.ts

# Live source CPU bench (plan step 9.5): 20 x 10 MB synthetic transcripts in var/bench/, 5 growing
# for 30 s; prints CPU % and RSS, fails above 5 %. Not a gate; var/bench/ is removed afterwards.
bench-live: $(DEPS)
	BENCH=1 $(BIN)/vitest run --disableConsoleIntercept test/live-cpu.bench.ts

# Footprint bench (RUN-3, #7): the built server on 20 x 10 MB synthetic transcripts in
# var/bench-mem/; prints start-up and RSS, fails above 2 s or 150 MB. Not a gate.
bench-mem: build
	BENCH=1 $(BIN)/vitest run --disableConsoleIntercept test/live-mem.bench.ts

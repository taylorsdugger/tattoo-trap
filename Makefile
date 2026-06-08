# Tattoo Trap — monorepo task runner
# Run `make` (or `make help`) to list targets.
#
# Layout:  apps/web  (Next.js)   pipeline/  (Python)   supabase/  (SQL migrations)

WEB_DIR      := apps/web
PIPELINE_DIR := pipeline
PIPELINE_PY  := $(PIPELINE_DIR)/.venv/bin/python   # used by both `uv sync` and venv installs

# Default metro for pipeline targets:  make pipeline METRO=peoria
METRO ?= chicago

# All metros, for `make pipeline-ig-all`. Add new metros here (and a seeds/<slug>.csv +
# a `metros` row in Supabase). Override ad hoc: make pipeline-ig-all METROS="chicago peoria"
METROS ?= chicago peoria iowa-city quad-cities

.DEFAULT_GOAL := help
.PHONY: help install web-install pipeline-install dev web-build web-start web-lint \
        pipeline pipeline-ig pipeline-ig-all seed crawl scrape-ig probe-ig ig-status \
        ig-count embed embed-pending pipeline-test supabase-push clean clean-web clean-pipeline

help: ## Show this help
	@echo "Tattoo Trap — make targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n",$$1,$$2}'
	@echo ""
	@echo "  Pipeline metro override:  make pipeline METRO=iowa-city"

# --- install ---------------------------------------------------------------------------

install: web-install pipeline-install ## Install everything (web + pipeline)

web-install: ## Install web dependencies (npm)
	cd $(WEB_DIR) && npm install

pipeline-install: ## Install Python pipeline (uv if present, else venv) + Playwright Chromium
	@if command -v uv >/dev/null 2>&1; then \
		echo ">> uv detected — uv sync"; \
		cd $(PIPELINE_DIR) && uv sync --extra dev; \
	else \
		echo ">> uv not found — using python3 venv"; \
		cd $(PIPELINE_DIR) && python3 -m venv .venv \
			&& .venv/bin/pip install --upgrade pip \
			&& .venv/bin/pip install -e ".[dev]"; \
	fi
	@$(PIPELINE_PY) -m playwright install chromium

# --- web -------------------------------------------------------------------------------

dev: ## Run the web app in dev mode (http://localhost:3002)
	cd $(WEB_DIR) && npm run dev

web-build: ## Production build of the web app
	cd $(WEB_DIR) && npm run build

web-start: ## Start the production web build
	cd $(WEB_DIR) && npm run start

web-lint: ## Lint the web app
	cd $(WEB_DIR) && npm run lint

# --- pipeline --------------------------------------------------------------------------

pipeline: seed crawl embed ## Full pipeline for METRO: seed -> crawl -> embed

pipeline-ig: scrape-ig embed ## IG backfill for METRO: scrape Instagram -> embed (run back-to-back; IG URLs expire)

pipeline-ig-all: ## IG backfill across ALL $(METROS): scrape+embed each metro (budget-capped, de-duped)
	@echo ">> Apify status before run:"; \
	$(PIPELINE_PY) -m tattoo_trap.scrape_instagram --status || true; \
	for m in $(METROS); do \
		echo ""; echo ">> ===== IG pipeline: $$m ====="; \
		$(PIPELINE_PY) -m tattoo_trap.scrape_instagram --metro $$m || exit $$?; \
		$(PIPELINE_PY) -m tattoo_trap.embed_images --metro $$m || exit $$?; \
	done; \
	echo ""; echo ">> Apify status after run:"; \
	$(PIPELINE_PY) -m tattoo_trap.scrape_instagram --status || true

seed: ## Seed shops for METRO from pipeline/seeds/<metro>.csv
	$(PIPELINE_PY) -m tattoo_trap.seed_shops --metro $(METRO)

crawl: ## Crawl shop sites for METRO (artists, IG handles, image URLs)
	$(PIPELINE_PY) -m tattoo_trap.crawl_shops --metro $(METRO)

scrape-ig: ## Source portfolio images from artists' Instagram for METRO (paid scraper, budget-capped)
	$(PIPELINE_PY) -m tattoo_trap.scrape_instagram --metro $(METRO)

probe-ig: ## Quality check: fetch a few IG handles for METRO, print URLs, write nothing
	$(PIPELINE_PY) -m tattoo_trap.scrape_instagram --metro $(METRO) --probe

ig-status: ## Show Apify month-to-date spend vs. cap (read-only, free)
	$(PIPELINE_PY) -m tattoo_trap.scrape_instagram --status

ig-count: ## Show how many artists the puller would scrape for METRO + cycle estimate (no Apify calls)
	$(PIPELINE_PY) -m tattoo_trap.scrape_instagram --metro $(METRO) --count

embed: ## Download + embed portfolio images for METRO
	$(PIPELINE_PY) -m tattoo_trap.embed_images --metro $(METRO)

embed-pending: ## Embed ALL pending candidates (drains what the live "fetch images" button queued)
	$(PIPELINE_PY) -m tattoo_trap.embed_images --all

pipeline-test: ## Run pipeline tests (CLIP parity / invariants)
	$(PIPELINE_PY) -m pytest -q

# --- supabase --------------------------------------------------------------------------

supabase-push: ## Apply SQL migrations via Supabase CLI (run `supabase link` first)
	cd $(PIPELINE_DIR)/.. && supabase db push

# --- clean -----------------------------------------------------------------------------

clean: clean-web clean-pipeline ## Remove build artifacts and virtualenvs

clean-web:
	rm -rf $(WEB_DIR)/.next $(WEB_DIR)/node_modules

clean-pipeline:
	rm -rf $(PIPELINE_DIR)/.venv $(PIPELINE_DIR)/**/__pycache__ \
		$(PIPELINE_DIR)/.pytest_cache $(PIPELINE_DIR)/*.egg-info $(PIPELINE_DIR)/src/*.egg-info

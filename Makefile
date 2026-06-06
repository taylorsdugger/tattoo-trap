# Tattoo Trap — monorepo task runner
# Run `make` (or `make help`) to list targets.
#
# Layout:  apps/web  (Next.js)   pipeline/  (Python)   supabase/  (SQL migrations)

WEB_DIR      := apps/web
PIPELINE_DIR := pipeline
PIPELINE_PY  := $(PIPELINE_DIR)/.venv/bin/python   # used by both `uv sync` and venv installs

# Default metro for pipeline targets:  make pipeline METRO=peoria
METRO ?= chicago

.DEFAULT_GOAL := help
.PHONY: help install web-install pipeline-install dev web-build web-start web-lint \
        pipeline seed crawl embed pipeline-test supabase-push clean clean-web clean-pipeline

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

dev: ## Run the web app in dev mode (http://localhost:3000)
	cd $(WEB_DIR) && npm run dev

web-build: ## Production build of the web app
	cd $(WEB_DIR) && npm run build

web-start: ## Start the production web build
	cd $(WEB_DIR) && npm run start

web-lint: ## Lint the web app
	cd $(WEB_DIR) && npm run lint

# --- pipeline --------------------------------------------------------------------------

pipeline: seed crawl embed ## Full pipeline for METRO: seed -> crawl -> embed

seed: ## Seed shops for METRO from pipeline/seeds/<metro>.csv
	$(PIPELINE_PY) -m tattoo_trap.seed_shops --metro $(METRO)

crawl: ## Crawl shop sites for METRO (artists, IG handles, image URLs)
	$(PIPELINE_PY) -m tattoo_trap.crawl_shops --metro $(METRO)

embed: ## Download + embed portfolio images for METRO
	$(PIPELINE_PY) -m tattoo_trap.embed_images --metro $(METRO)

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

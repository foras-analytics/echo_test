#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v uv >/dev/null || { echo 'Install uv: https://docs.astral.sh/uv/getting-started/installation/'; exit 1; }
command -v npm >/dev/null || { echo 'Install Node.js 20.19+ or 22.12+ (includes npm).'; exit 1; }
uv sync --frozen
if [ ! -d frontend/node_modules ]; then
  npm --prefix frontend ci
fi
npm --prefix frontend run build
echo 'Open ECHO at http://127.0.0.1:8000 (Ctrl+C to stop).'
exec uv run uvicorn echo.main:app --app-dir backend --host 127.0.0.1 --port 8000 --no-access-log

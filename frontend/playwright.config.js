import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:5174', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'uv run uvicorn echo.main:app --app-dir backend --host 127.0.0.1 --port 8001 --no-access-log', cwd: '..', url: 'http://127.0.0.1:8001/api/health', reuseExistingServer: false },
    { command: 'npm run dev -- --port 5174', env: { ECHO_API_URL: 'http://127.0.0.1:8001' }, url: 'http://127.0.0.1:5174', reuseExistingServer: false },
  ],
})

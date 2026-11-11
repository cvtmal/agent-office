// Browser smoke tests (`make e2e`, not a gate). The Makefile passes PORT, so a
// lane runs against its own port; outputs stay under the ignored var/.
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env['PORT'] ?? 4477);
const baseURL = `http://127.0.0.1:${String(port)}`;
const viewport = { width: 1280, height: 800 };

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'var/test-results',
  reporter: 'list',
  use: { baseURL },
  webServer: {
    command: `bin/agent-office --dev --sample --port ${String(port)}`,
    url: `${baseURL}/api/snapshot`,
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport } },
    { name: 'desktop-2x', use: { ...devices['Desktop Chrome'], viewport, deviceScaleFactor: 2 } },
  ],
});

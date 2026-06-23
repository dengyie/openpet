const { defineConfig, devices } = require('@playwright/test')

function readControlCenterPort() {
  const rawPort = process.env.OPENPET_CONTROL_CENTER_TEST_PORT || '5173'
  const port = Number(rawPort)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`OPENPET_CONTROL_CENTER_TEST_PORT must be an integer TCP port, received "${rawPort}".`)
  }

  return port
}

const controlCenterPort = readControlCenterPort()
const controlCenterBaseUrl = `http://127.0.0.1:${controlCenterPort}`

module.exports = defineConfig({
  testDir: './tests/control-center',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: controlCenterBaseUrl,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: `npm run dev:control-center -- --port ${controlCenterPort} --strictPort`,
    url: controlCenterBaseUrl,
    reuseExistingServer: process.env.OPENPET_REUSE_CONTROL_CENTER_SERVER === '1',
    timeout: 30_000
  }
})

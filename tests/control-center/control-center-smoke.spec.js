const { test, expect } = require('@playwright/test')

const tabs = ['Pet', 'Actions', 'AI', 'Plugins', 'Catalog', 'Service', 'About']
const pageErrorsByPage = new WeakMap()

test.describe('Control Center smoke', () => {
  test.beforeEach(async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(message.text())
    })
    pageErrorsByPage.set(page, pageErrors)
  })

  test.afterEach(async ({ page }) => {
    expect(pageErrorsByPage.get(page)).toEqual([])
  })

  test('loads the app shell and every tab with the demo API', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle('OpenPet Control Center')
    await expect(page.getByText('OpenPet')).toBeVisible()
    await expect(page.getByText('Control Center')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pet' })).toBeVisible()

    for (const tab of tabs) {
      await page.getByRole('button', { name: tab }).click()
      await expect(page.getByRole('heading', { name: tab })).toBeVisible()
    }
  })

  test('keeps key Pet and About interactions responsive', async ({ page }) => {
    await page.goto('/')

    const scale = page.locator('input[type="range"]')
    await expect(scale).toHaveValue('100')
    await scale.evaluate((input) => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      valueSetter.call(input, '125')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await expect(page.getByText('125%')).toBeVisible()

    await page.getByRole('button', { name: '快' }).click()
    await expect(page.getByRole('group', { name: '散步速度' }).getByRole('button', { name: '快' })).toHaveClass(/active/)

    await page.getByRole('button', { name: 'About' }).click()
    await page.getByRole('button', { name: '检查更新' }).click()
    await expect(page.locator('.readonly-row', { hasText: '更新状态' })).toContainText('Update feed is not configured.')
  })

  test('persists Pet settings in the demo API session', async ({ page }) => {
    await page.goto('/')

    const scale = page.locator('input[type="range"]')
    await scale.evaluate((input) => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      valueSetter.call(input, '135')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await page.getByRole('button', { name: '快' }).click()
    await page.getByRole('button', { name: '保存', exact: true }).click()

    await expect(page.locator('.status-line')).toContainText('原始大小 135%')
    await page.getByRole('button', { name: '还原' }).click()
    await expect(scale).toHaveValue('135')
    await expect(page.getByRole('group', { name: '散步速度' }).getByRole('button', { name: '快' })).toHaveClass(/active/)
  })

  test('persists AI config and clears API key drafts with the demo API', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'AI' }).click()

    await page.getByLabel('Base URL').fill('https://ai.example.test/v1')
    await page.getByLabel('Model').fill('openpet-test-model')
    await page.getByLabel('System Prompt').fill('Stay tiny, helpful, and local-first.')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.locator('.status-line')).toContainText('AI 配置已保存')

    const apiKeyInput = page.locator('.field-row', { hasText: 'API Key' }).locator('input[type="password"]')
    await apiKeyInput.fill('sk-demo-secret')
    await page.getByRole('button', { name: '保存密钥' }).click()
    await expect(page.locator('.status-line')).toContainText('API Key 已保存')
    await expect(apiKeyInput).toHaveValue('')
    await expect(page.locator('.field-row', { hasText: 'API Key' })).toContainText('已保存')

    await page.reload()
    await page.getByRole('button', { name: 'AI' }).click()
    await expect(page.getByLabel('Base URL')).toHaveValue('https://ai.example.test/v1')
    await expect(page.getByLabel('Model')).toHaveValue('openpet-test-model')
    await expect(page.getByLabel('System Prompt')).toHaveValue('Stay tiny, helpful, and local-first.')
    await expect(page.locator('.field-row', { hasText: 'API Key' })).toContainText('已保存')
  })

  test('persists Service config and exposes the updated loopback endpoint', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Service' }).click()

    await page.getByLabel('端口').fill('4317')
    await page.locator('.field-row', { hasText: 'HTTP API' }).getByRole('switch').click()
    await page.getByRole('button', { name: '保存', exact: true }).click()

    await expect(page.locator('.status-line')).toContainText('本地服务已启动')
    await expect(page.locator('.readonly-row', { hasText: '当前端点' })).toContainText('http://127.0.0.1:4317/api/status')
    await expect(page.getByText('MCPhttp://127.0.0.1:4317/mcp')).toBeVisible()

    await page.reload()
    await page.getByRole('button', { name: 'Service' }).click()
    await expect(page.getByLabel('端口')).toHaveValue('4317')
    await expect(page.locator('.readonly-row', { hasText: '当前端点' })).toContainText('http://127.0.0.1:4317/api/status')
  })
})

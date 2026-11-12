// Manual visual QA against an explicitly chosen local server.
import { chromium, expect } from '@playwright/test'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
await page.goto(process.env.ECHO_URL || 'http://127.0.0.1:5173')
const toggle = page.getByRole('switch', { name: 'Dark mode', exact: true })
async function captureBoth(screen) {
  await page.evaluate(async () => { await document.fonts.ready })
  await page.screenshot({ path: `/tmp/echo-${screen}-dark.png`, fullPage: true })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await page.screenshot({ path: `/tmp/echo-${screen}-light.png`, fullPage: true })
  await toggle.click()
}
await captureBoth('import')
await page.getByRole('button', { name: 'Try the sample archive' }).click()
await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor()
await captureBoth('overview')
await page.getByRole('navigation').getByRole('button', { name: /Keyword setup/ }).click()
await page.locator('.ranked-list button').first().waitFor()
for (const word of ['Alpha', 'Bravo', 'Echo']) {
  await page.getByRole('textbox', { name: 'Word or literal phrase' }).fill(word)
  await page.getByRole('button', { name: 'Save keyword', exact: true }).click()
}
await captureBoth('keywords')
await page.getByRole('navigation').getByRole('button', { name: /Message explorer/ }).click()
await page.locator('.keyword-chip', { hasText: /^Alpha$/ }).click()
await expect(page.locator('.results-toolbar')).toContainText('9 messages')
await page.getByRole('button', { name: 'Timing', exact: true }).click()
await captureBoth('explorer')
console.log('Browser:', browser.version())
await browser.close()

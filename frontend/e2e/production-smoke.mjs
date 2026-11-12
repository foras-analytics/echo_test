import { chromium, expect } from '@playwright/test'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const response = await page.goto(process.env.ECHO_URL || 'http://127.0.0.1:8000')
expect(response.status()).toBe(200)
const begin = Date.now()
await page.getByRole('button', { name: 'Try the sample archive' }).click()
await page.getByRole('heading', { name: 'Overview' }).waitFor()
console.log('Production import to overview (ms):', Date.now() - begin)
await page.getByRole('navigation').getByRole('button', { name: /Message explorer/ }).click()
await expect(page.locator('.results-toolbar')).toContainText('7,000 messages')
const frames = await page.getByTestId('message-scroll').evaluate(async element => {
  const samples = []; let last = performance.now()
  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve))
    const now = performance.now(); samples.push(now - last); last = now
    element.scrollTop += 160
  }
  return samples.slice(2).sort((a, b) => a - b)
})
console.log('Scroll frame median/p95 (ms):', frames[Math.floor(frames.length * .5)].toFixed(1), frames[Math.floor(frames.length * .95)].toFixed(1))
const canvas = page.locator('canvas'), box = await canvas.boundingBox(), seek = Date.now()
await canvas.click({ position: { x: box.width * .9, y: 12 } })
await expect(page.locator('[data-message-id]:focus')).toBeVisible()
console.log('Production timeline seek (ms):', Date.now() - seek)
console.log('Rendered rows for 7,000-message archive:', await page.locator('[data-message-id]').count())
console.log('Browser:', browser.version())
expect(errors).toEqual([])
await browser.close()

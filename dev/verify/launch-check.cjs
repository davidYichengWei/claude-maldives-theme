// Launches Playwright's Chromium, renders a scrap of SVG, and prints the
// browser's version. Exits non-zero when it cannot.
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1'
const { chromium } = require('playwright-core')
;(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] })
  const page = await browser.newPage()
  await page.setContent('<svg width="10" height="10"><rect width="10" height="10" fill="#c97b5e"/></svg>')
  const pixel = await page.evaluate(() => getComputedStyle(document.querySelector('rect')).fill)
  console.log(`chromium ${browser.version()} renders: ${pixel}`)
  await browser.close()
})().catch(error => {
  console.error(String(error).split('\n').slice(0, 3).join('\n'))
  process.exit(1)
})

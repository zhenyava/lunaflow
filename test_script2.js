import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5174');
  await page.waitForTimeout(5000);

  // Try 1440x900 - large
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'large2.png' });

  // Try 1440x600 - compressed
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'compressed2.png' });

  await browser.close();
})();

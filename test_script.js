import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate to local dev server (assuming it's running)
  await page.goto('http://localhost:5174');

  // Wait for the calendar to render (wait for daypicker OR just wait some time)
  await page.waitForTimeout(5000);

  // Screen 1: Large screen
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'large.png' });

  // Screen 2: Compressed vertical screen
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'compressed.png' });

  await browser.close();
})();

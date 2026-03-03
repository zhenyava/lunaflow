import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5174/calendar');
  await page.waitForTimeout(5000);

  // Large screen: capture DOM metrics
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'large4.png' });

  // Compressed screen: capture DOM metrics
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'compressed4.png' });

  await browser.close();
})();

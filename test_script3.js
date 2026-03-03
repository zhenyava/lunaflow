import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5174/calendar');
  await page.waitForTimeout(5000);

  // Large screen: capture DOM metrics
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000);
  const largeMetrics = await page.evaluate(() => {
    const grid = document.querySelector('.grid-cols-4');
    const firstMonth = grid ? grid.children[0] : null;
    return {
      gridHeight: grid ? grid.clientHeight : null,
      monthHeight: firstMonth ? firstMonth.clientHeight : null,
      monthWidth: firstMonth ? firstMonth.clientWidth : null
    };
  });

  // Compressed screen: capture DOM metrics
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.waitForTimeout(1000);
  const compressedMetrics = await page.evaluate(() => {
    const grid = document.querySelector('.grid-cols-4');
    const firstMonth = grid ? grid.children[0] : null;
    return {
      gridHeight: grid ? grid.clientHeight : null,
      monthHeight: firstMonth ? firstMonth.clientHeight : null,
      monthWidth: firstMonth ? firstMonth.clientWidth : null
    };
  });

  console.log("Large metrics:", largeMetrics);
  console.log("Compressed metrics:", compressedMetrics);

  await browser.close();
})();

import { test, expect, chromium } from '@playwright/test';
import { createRoom } from './helpers';

test('Proof: hash stripped within 2s and reload reconnects', async () => {
  const browser = await chromium.launch({ headless: true });
  
  const { pageA, inviteUrl, contextA } = await createRoom(browser);
  
  // New context joins with full invite URL
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  
  await pageB.goto(inviteUrl);
  await pageB.waitForTimeout(2000);
  
  const hashAfter2s = await pageB.evaluate(() => window.location.hash);
  console.log('Hash after 2s:', hashAfter2s);
  expect(hashAfter2s).toBe('');
  
  // Reload page
  await pageB.reload();
  await expect(pageB.locator('[data-testid="status-text"]:has-text("Connected")')).toBeVisible({ timeout: 5000 });
  
  const hashAfterReload = await pageB.evaluate(() => window.location.hash);
  console.log('Hash after reload:', hashAfterReload);
  expect(hashAfterReload).toBe('');

  await contextB.close();
  await contextA.close();
  await browser.close();
});

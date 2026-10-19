import { test, expect, chromium } from '@playwright/test';
import { createRoom } from './helpers';

test('PW-04: D with wrong secret is refused', async () => {
  const browser = await chromium.launch({ headless: true });
  
  const { pageA, contextA } = await createRoom(browser);
  const roomUrl = pageA.url();
  const roomId = roomUrl.match(/\/r\/([^?#]+)/)?.[1];
  
  const contextD = await browser.newContext();
  const pageD = await contextD.newPage();
  
  await pageD.goto(`http://localhost:5199/r/${roomId}#k=AAAAAAAAAAAAAAAAAAAAAA`);
  await expect(pageD.locator('[data-testid="status-text"]:has-text("denied")')).toBeVisible({ timeout: 5000 });

  await contextD.close();
  await contextA.close();
  await browser.close();
});

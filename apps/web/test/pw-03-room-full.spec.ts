import { test, expect, chromium } from '@playwright/test';
import { createRoom, joinRoom } from './helpers';

test('PW-03: C gets "room full" when A and B are connected', async () => {
  const browser = await chromium.launch({ headless: true });
  
  const { pageA, inviteUrl, contextA } = await createRoom(browser);
  const { page: pageB, context: contextB } = await joinRoom(browser, inviteUrl);
  
  const contextC = await browser.newContext();
  const pageC = await contextC.newPage();
  await pageC.goto(inviteUrl);
  await expect(pageC.locator('[data-testid="status-text"]:has-text("full")')).toBeVisible({ timeout: 5000 });

  await contextC.close();
  await contextB.close();
  await contextA.close();
  await browser.close();
});

import { Browser, BrowserContext, Page, expect } from '@playwright/test';

export async function createRoom(browser: Browser): Promise<{ pageA: Page; inviteUrl: string; contextA: BrowserContext }> {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();

  await pageA.goto('http://localhost:5199');
  await pageA.click('button:has-text("Create Room")');
  await expect(pageA).toHaveURL(/\/r\/[0-9A-Z]{10}$/, { timeout: 5000 });
  
  await pageA.click('[data-testid="copy-invite"]');
  const inviteUrl = await pageA.getAttribute('[data-testid="copy-invite"]', 'data-invite-url');
  
  if (!inviteUrl) throw new Error('Failed to get invite URL');
  
  return { pageA, inviteUrl, contextA };
}

export async function joinRoom(browser: Browser, inviteUrl: string): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto(inviteUrl);
  await expect(page.locator('[data-testid="status-text"]:has-text("Connected")')).toBeVisible({ timeout: 5000 });
  
  return { page, context };
}

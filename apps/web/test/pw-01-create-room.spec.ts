import { test, expect, chromium } from '@playwright/test';

test('PW-01: A creates room, #k fragment removed from address bar', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:5173');
  await page.click('button:has-text("Create Room")');
  await page.waitForURL(/\/r\//, { timeout: 5000 });
  
  const url = page.url();
  expect(url).toMatch(/\/r\/[0-9A-Z]{10}$/);
  expect(url).not.toContain('#k=');
  
  await page.click('button:has-text("Copy")');
  const inviteUrl = await page.getAttribute('button[data-invite-url]', 'data-invite-url');
  expect(inviteUrl).toContain('#k=');
  expect(inviteUrl).toMatch(/#k=[A-Za-z0-9_-]{43}/);

  await context.close();
  await browser.close();
});

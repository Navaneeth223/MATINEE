import { test, expect } from '@playwright/test';

test.describe('Room full bug reproduction', () => {
  test('A creates, B joins -> should both be Connected, not "Room is full"', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      // A: Create room
      await pageA.goto('http://localhost:5199');
      await pageA.getByRole('button', { name: /create our room/i }).click();
      
      await expect(pageA.getByTestId('status-text')).toBeVisible({ timeout: 5000 });
      
      // Wait for Connected or at least not "Reading secret..."
      await pageA.waitForTimeout(2000);
      
      // Get invite URL
      const inviteUrlAttr = await pageA.locator('[data-invite-url]').getAttribute('data-invite-url');
      expect(inviteUrlAttr).toBeTruthy();
      const inviteUrl = inviteUrlAttr!;
      
      console.log('Invite URL:', inviteUrl);
      console.log('A status:', await pageA.getByTestId('status-text').textContent());
      
      // B: Join using invite link
      await pageB.goto(inviteUrl);
      
      // Wait for status to update
      await pageB.waitForTimeout(3000);
      
      const statusA = await pageA.getByTestId('status-text').textContent();
      const statusB = await pageB.getByTestId('status-text').textContent();
      
      console.log('A final status:', statusA);
      console.log('B final status:', statusB);
      
      // Check for the bug: B should NOT say "Room is full"
      expect(statusB).not.toContain('full');
      expect(statusB).not.toContain('Full');
      
      // Both should eventually be Connected
      await expect(pageA.getByTestId('status-text')).toContainText('Connected', { timeout: 10000 });
      await expect(pageB.getByTestId('status-text')).toContainText('Connected', { timeout: 10000 });
      
    } finally {
      await pageA.close();
      await pageB.close();
      await ctxA.close();
      await ctxB.close();
    }
  });
});

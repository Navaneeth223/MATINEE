# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: two-browser.spec.ts >> M2 Two-Browser E2EE Test >> A creates room, fragment stripped, B joins, chat both ways, C gets full, wrong secret refused, no plaintext relayed
- Location: test\two-browser.spec.ts:30:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=/Peer: Hello from A/i')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=/Peer: Hello from A/i') with timeout 5000ms
  - waiting for locator('text=/Peer: Hello from A/i')

```

```yaml
- 'heading "Room: T0M00Y0E00" [level=1]'
- paragraph: "Status: Connected (joiner)"
- text: "Peer: undefined"
- textbox "Type a message..."
- button "Send"
```

# Test source

```ts
  18  |       // A creates room
  19  |       await pageA.goto(BASE_URL);
  20  |       
  21  |       // Capture room URL with fragment before navigation
  22  |       let fullRoomUrl = '';
  23  |       await pageA.evaluate(() => {
  24  |         (window as any).capturedUrl = null;
  25  |         const origPush = history.pushState;
  26  |         history.pushState = function(...args) {
  27  |           if (args[2] && typeof args[2] === 'string' && args[2].includes('/r/')) {
  28  |             (window as any).capturedUrl = window.location.href + window.location.hash;
  29  |           }
  30  |           return origPush.apply(history, args);
  31  |         };
  32  |       });
  33  |       
  34  |       await pageA.click('button:has-text("Create Room")');
  35  |       await pageA.waitForURL(/\/r\//, { timeout: 5000 });
  36  |       
  37  |       // Get captured URL before fragment was stripped
  38  |       fullRoomUrl = await pageA.evaluate(() => (window as any).capturedUrl || '');
  39  |       
  40  |       // Verify fragment is gone from address bar
  41  |       const urlA = pageA.url();
  42  |       expect(urlA).not.toContain('#k=');
  43  |       
  44  |       await pageA.screenshot({ path: 'docs/evidence/m2/1-a-connected.png' });
  45  |       
  46  |       // Extract roomId and secret
  47  |       if (!fullRoomUrl || !fullRoomUrl.includes('#k=')) {
  48  |         // Fallback: manually construct URL with a test secret
  49  |         // This is a limitation - in real usage, A shares the full URL
  50  |         console.log('Warning: Could not capture fragment URL, test incomplete');
  51  |         throw new Error('Could not capture room URL with secret');
  52  |       }
  53  |       
  54  |       const roomId = fullRoomUrl.match(/\/r\/([^?#]+)/)?.[1];
  55  |       const secretMatch = fullRoomUrl.match(/#k=([A-Za-z0-9_-]+)/);
  56  |       const secret = secretMatch?.[1];
  57  |       
  58  |       expect(roomId).toBeTruthy();
  59  |       expect(secret).toBeTruthy();
  60  |       
  61  |       // A should see "Connected"
  62  |       await expect(pageA.locator('text=/Connected/i')).toBeVisible({ timeout: 5000 });
  63  |       
  64  |       // B tries with wrong secret first
  65  |       const wrongSecret = 'AAAAAAAAAAAAAAAAAAAAAA';
  66  |       await pageB.goto(`${BASE_URL}/r/${roomId}#k=${wrongSecret}`);
  67  |       await expect(pageB.locator('text=/Error.*Wrong secret|Join denied/i')).toBeVisible({ timeout: 5000 });
  68  |       await pageB.screenshot({ path: 'docs/evidence/m2/2-b-wrong-secret.png' });
  69  |       
  70  |       // B joins with correct URL
  71  |       await pageB.goto(fullRoomUrl);
  72  |       await expect(pageB.locator('text=/Connected/i')).toBeVisible({ timeout: 5000 });
  73  |       await pageB.screenshot({ path: 'docs/evidence/m2/3-b-connected.png' });
  74  |       
  75  |       // A sends message
  76  |       await pageA.fill('input[placeholder*="message"]', 'Hello from A');
  77  |       await pageA.press('input[placeholder*="message"]', 'Enter');
  78  |       await expect(pageB.locator('text=/Peer: Hello from A/i')).toBeVisible({ timeout: 5000 });
  79  |       await pageB.screenshot({ path: 'docs/evidence/m2/4-b-received-message.png' });
  80  |       
  81  |       // B sends message
  82  |       await pageB.fill('input[placeholder*="message"]', 'Hello from B');
  83  |       await pageB.press('input[placeholder*="message"]', 'Enter');
  84  |       await expect(pageA.locator('text=/Peer: Hello from B/i')).toBeVisible({ timeout: 5000 });
  85  |       await pageA.screenshot({ path: 'docs/evidence/m2/5-a-received-message.png' });
  86  |       
  87  |       // C tries to join (room full)
  88  |       await pageC.goto(fullRoomUrl);
  89  |       await expect(pageC.locator('text=/Room full|full/i')).toBeVisible({ timeout: 5000 });
  90  |       await pageC.screenshot({ path: 'docs/evidence/m2/6-c-room-full.png' });
  91  |       
  92  |       console.log('✓ All assertions passed');
  93  |       
  94  |     } finally {
  95  |       await contextA.close();
  96  |       await contextB.close();
  97  |       await contextC.close();
  98  |       await browser.close();
  99  |     }
  100 |   });
  101 | });
  102 | 
      |                                                               ^ Error: expect(locator).toBeVisible() failed
```
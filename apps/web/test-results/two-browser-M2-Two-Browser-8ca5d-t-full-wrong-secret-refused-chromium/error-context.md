# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: two-browser.spec.ts >> M2 Two-Browser E2EE Test >> bidirectional chat, fragment stripped, third context full, wrong secret refused
- Location: test\two-browser.spec.ts:6:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=/Connected/i')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=/Connected/i') with timeout 5000ms
  - waiting for locator('text=/Connected/i')

```

```yaml
- 'heading "Room: 30J0010S00" [level=1]'
- paragraph: "Status: Error: Join denied: Wrong secret"
- button "Copy invite link"
- textbox "Type a message..."
- button "Send"
```

# Test source

```ts
  1   | import { test, expect, chromium } from '@playwright/test';
  2   | 
  3   | const BASE_URL = 'http://localhost:5173';
  4   | 
  5   | test.describe('M2 Two-Browser E2EE Test', () => {
  6   |   test('bidirectional chat, fragment stripped, third context full, wrong secret refused', async () => {
  7   |     const browser = await chromium.launch({ headless: true });
  8   |     
  9   |     const contextA = await browser.newContext();
  10  |     const contextB = await browser.newContext();
  11  |     const contextC = await browser.newContext();
  12  |     
  13  |     const pageA = await contextA.newPage();
  14  |     const pageB = await contextB.newPage();
  15  |     const pageC = await contextC.newPage();
  16  | 
  17  |     // Console and WebSocket logging for both pages
  18  |     const logsA: string[] = [];
  19  |     const logsB: string[] = [];
  20  |     
  21  |     pageA.on('console', msg => {
  22  |       logsA.push(`[A console] ${msg.type()}: ${msg.text()}`);
  23  |     });
  24  |     
  25  |     pageB.on('console', msg => {
  26  |       logsB.push(`[B console] ${msg.type()}: ${msg.text()}`);
  27  |     });
  28  |     
  29  |     pageA.on('websocket', ws => {
  30  |       logsA.push('[A websocket] created');
  31  |       ws.on('framesent', frame => logsA.push(`[A →] ${frame.payload?.toString().substring(0, 200)}`));
  32  |       ws.on('framereceived', frame => logsA.push(`[A ←] ${frame.payload?.toString().substring(0, 200)}`));
  33  |       ws.on('close', () => logsA.push('[A websocket] closed'));
  34  |     });
  35  |     
  36  |     pageB.on('websocket', ws => {
  37  |       logsB.push('[B websocket] created');
  38  |       ws.on('framesent', frame => logsB.push(`[B →] ${frame.payload?.toString().substring(0, 200)}`));
  39  |       ws.on('framereceived', frame => logsB.push(`[B ←] ${frame.payload?.toString().substring(0, 200)}`));
  40  |       ws.on('close', () => logsB.push('[B websocket] closed'));
  41  |     });
  42  | 
  43  |     try {
  44  |       // A creates room
  45  |       await pageA.goto(BASE_URL);
  46  |       await pageA.click('button:has-text("Create Room")');
  47  |       await pageA.waitForURL(/\/r\//, { timeout: 5000 });
  48  |       
  49  |       // Verify fragment is stripped from address bar
  50  |       const urlA = pageA.url();
  51  |       expect(urlA).not.toContain('#k=');
  52  |       logsA.push(`[A] Final URL: ${urlA}`);
  53  |       
  54  |       await pageA.screenshot({ path: 'docs/evidence/m2/1-a-connected.png' });
  55  |       
  56  |       // Wait for "Copy invite link" button to appear
  57  |       await pageA.waitForSelector('button:has-text("Copy")', { timeout: 5000 });
  58  |       
  59  |       // Click copy button to get invite URL
  60  |       await pageA.click('button:has-text("Copy")');
  61  |       
  62  |       // Read from data attribute instead of clipboard
  63  |       const fullRoomUrl = await pageA.getAttribute('button[data-invite-url]', 'data-invite-url');
  64  |       logsA.push(`[A] Copied invite URL: ${fullRoomUrl}`);
  65  |       
  66  |       expect(fullRoomUrl).toContain('#k=');
  67  |       const secretMatch = fullRoomUrl.match(/#k=([A-Za-z0-9_-]+)/);
  68  |       expect(secretMatch).toBeTruthy();
  69  |       
  70  |       const roomId = urlA.match(/\/r\/([^?#]+)/)?.[1];
  71  |       const wrongSecret = 'AAAAAAAAAAAAAAAAAAAAAA';
  72  |       
  73  |       // B tries with wrong secret first
  74  |       await pageB.goto(`${BASE_URL}/r/${roomId}#k=${wrongSecret}`);
  75  |       await expect(pageB.locator('text=/Error.*Wrong secret|Join denied/i')).toBeVisible({ timeout: 5000 });
  76  |       await pageB.screenshot({ path: 'docs/evidence/m2/2-b-wrong-secret.png' });
  77  |       logsB.push('[B] Wrong secret - join denied as expected');
  78  |       
  79  |       // B joins with correct URL from clipboard
  80  |       await pageB.goto(fullRoomUrl);
> 81  |       await expect(pageB.locator('text=/Connected/i')).toBeVisible({ timeout: 5000 });
      |                                                        ^ Error: expect(locator).toBeVisible() failed
  82  |       await pageB.screenshot({ path: 'docs/evidence/m2/3-b-connected.png' });
  83  |       logsB.push('[B] Connected with correct secret');
  84  |       
  85  |       // Wait a bit for WebSocket messages to settle
  86  |       await pageA.waitForTimeout(1000);
  87  |       await pageB.waitForTimeout(1000);
  88  |       
  89  |       // A sends message to B
  90  |       await pageA.fill('input[placeholder*="message"]', 'Hello from A');
  91  |       await pageA.press('input[placeholder*="message"]', 'Enter');
  92  |       logsA.push('[A] Sent message: Hello from A');
  93  |       
  94  |       // Wait and check if B received
  95  |       await pageB.waitForTimeout(2000);
  96  |       
  97  |       // Check B's page for message
  98  |       const bHasMessage = await pageB.locator('text=/Peer: Hello from A/i').isVisible();
  99  |       logsB.push(`[B] Message visible: ${bHasMessage}`);
  100 |       
  101 |       if (!bHasMessage) {
  102 |         console.log('\n=== PAGE A LOGS ===');
  103 |         logsA.forEach(log => console.log(log));
  104 |         console.log('\n=== PAGE B LOGS ===');
  105 |         logsB.forEach(log => console.log(log));
  106 |       }
  107 |       
  108 |       expect(bHasMessage).toBe(true);
  109 |       await pageB.screenshot({ path: 'docs/evidence/m2/4-b-received-message.png' });
  110 |       
  111 |       // B sends message to A
  112 |       await pageB.fill('input[placeholder*="message"]', 'Hello from B');
  113 |       await pageB.press('input[placeholder*="message"]', 'Enter');
  114 |       logsB.push('[B] Sent message: Hello from B');
  115 |       
  116 |       await pageA.waitForTimeout(2000);
  117 |       
  118 |       const aHasMessage = await pageA.locator('text=/Peer: Hello from B/i').isVisible();
  119 |       logsA.push(`[A] Message visible: ${aHasMessage}`);
  120 |       
  121 |       if (!aHasMessage) {
  122 |         console.log('\n=== PAGE A LOGS (after B sent) ===');
  123 |         logsA.forEach(log => console.log(log));
  124 |         console.log('\n=== PAGE B LOGS (after B sent) ===');
  125 |         logsB.forEach(log => console.log(log));
  126 |       }
  127 |       
  128 |       expect(aHasMessage).toBe(true);
  129 |       await pageA.screenshot({ path: 'docs/evidence/m2/5-a-received-message.png' });
  130 |       
  131 |       // C tries to join (room full)
  132 |       await pageC.goto(fullRoomUrl);
  133 |       await expect(pageC.locator('text=/Room full|full/i')).toBeVisible({ timeout: 5000 });
  134 |       await pageC.screenshot({ path: 'docs/evidence/m2/6-c-room-full.png' });
  135 |       
  136 |       console.log('\n=== ALL TESTS PASSED ===');
  137 |       
  138 |     } catch (error) {
  139 |       console.log('\n=== TEST FAILED ===');
  140 |       console.log('\n=== PAGE A LOGS ===');
  141 |       logsA.forEach(log => console.log(log));
  142 |       console.log('\n=== PAGE B LOGS ===');
  143 |       logsB.forEach(log => console.log(log));
  144 |       throw error;
  145 |       
  146 |     } finally {
  147 |       await contextA.close();
  148 |       await contextB.close();
  149 |       await contextC.close();
  150 |       await browser.close();
  151 |     }
  152 |   });
  153 | });
  154 | 
```
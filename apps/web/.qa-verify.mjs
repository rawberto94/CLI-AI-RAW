import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3005';
const cookieLine = fs.readFileSync('/tmp/cookies-a.txt', 'utf-8')
  .split('\n').find(l => l.includes('authjs.session-token'));
const sessionToken = cookieLine.split('\t').pop().trim();

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
await context.addCookies([
  { name: 'authjs.session-token', value: sessionToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
  { name: 'NEXT_LOCALE', value: 'de', domain: 'localhost', path: '/', sameSite: 'Lax' },
]);
const page = await context.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

const routes = process.argv.slice(2);
for (const route of routes) {
  errors.length = 0;
  console.log(`\n=== ${route} ===`);
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  const text = (await page.locator('body').innerText()).slice(0, 400);
  console.log('TEXT:', text.replace(/\n+/g, ' | '));
  console.log('ERRORS:', errors.length ? errors.slice(0,3).join(' ;; ') : '(none)');
}
await browser.close();

import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3005';
const cookieLine = fs.readFileSync('/tmp/cookies-a.txt', 'utf-8')
  .split('\n')
  .find(l => l.includes('authjs.session-token'));
const sessionToken = cookieLine.split('\t').pop().trim();

const routes = fs.readFileSync(
  '/tmp/claude-0/-root-app/776eb1ee-f95c-4f1b-b0fb-8369c9bcded4/scratchpad/qa/routes.txt',
  'utf-8'
).split('\n').map(l => l.trim()).filter(Boolean);

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
await context.addCookies([
  { name: 'authjs.session-token', value: sessionToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
  { name: 'NEXT_LOCALE', value: 'de', domain: 'localhost', path: '/', sameSite: 'Lax' },
]);
const page = await context.newPage();

let errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 200)));

const results = [];

for (const route of routes) {
  errors = [];
  const url = `${BASE}${route}`;
  let loaded = false;
  let lastErr = '';
  for (let attempt = 0; attempt < 2 && !loaded; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      loaded = true;
    } catch (e) {
      lastErr = e.message.slice(0, 100);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (!loaded) {
    results.push(`${route} — UNREACHABLE: ${lastErr}`);
    console.log(`${route} — UNREACHABLE: ${lastErr}`);
    continue;
  }
  await page.waitForTimeout(900);
  try {
    const skipTour = page.getByText('Skip Tour');
    if (await skipTour.isVisible({ timeout: 500 }).catch(() => false)) {
      await skipTour.click();
      await page.waitForTimeout(300);
    }
  } catch {}
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const trimmed = bodyText.trim();
  const isNearEmpty = trimmed.length < 40;
  const hasErrorBoundary = /something went wrong|application error|unhandled runtime error/i.test(bodyText);
  const realErrors = errors.filter(e =>
    !/ClientFetchError|Failed to fetch|No tenant ID found|DevTools|tanstack_query-devtools/i.test(e)
  );
  let status = 'PASS';
  let detail = '';
  if (isNearEmpty) { status = 'FAIL'; detail = 'near-empty body'; }
  else if (hasErrorBoundary) { status = 'FAIL'; detail = 'error boundary shown'; }
  else if (realErrors.length > 0) { status = 'PARTIAL'; detail = realErrors[0]; }
  results.push(`${route} — ${status}${detail ? ': ' + detail : ''}`);
  console.log(`${route} — ${status}${detail ? ': ' + detail : ''}`);
}

fs.writeFileSync(
  '/tmp/claude-0/-root-app/776eb1ee-f95c-4f1b-b0fb-8369c9bcded4/scratchpad/qa/full-results.txt',
  results.join('\n') + '\n'
);

const pass = results.filter(r => r.includes('— PASS')).length;
const fail = results.filter(r => r.includes('— FAIL')).length;
const partial = results.filter(r => r.includes('— PARTIAL')).length;
const unreachable = results.filter(r => r.includes('— UNREACHABLE')).length;
console.log(`\n=== SUMMARY: ${results.length} routes — ${pass} PASS, ${fail} FAIL, ${partial} PARTIAL, ${unreachable} UNREACHABLE ===`);

await browser.close();

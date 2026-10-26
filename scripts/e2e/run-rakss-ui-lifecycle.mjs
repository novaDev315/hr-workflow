import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch {
    const playwrightModuleDir = process.env.PLAYWRIGHT_MODULE_DIR;
    if (!playwrightModuleDir) {
      throw new Error('Unable to load playwright; set PLAYWRIGHT_MODULE_DIR to a node_modules/playwright directory');
    }
    const requireFromPlaywright = createRequire(`${playwrightModuleDir}/package.json`);
    ({ chromium } = requireFromPlaywright('playwright'));
  }
}


function assertLocalTarget(label, value) {
  const { hostname } = new URL(value);
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
  if (!local && process.env.RAKSS_E2E_ALLOW_REMOTE !== '1') {
    throw new Error(
      `Refusing to run the destructive UI lifecycle sweep against non-local ${label} ${value}. ` +
        'It creates and deletes data. Use a local stack (default http://localhost:5173) or set RAKSS_E2E_ALLOW_REMOTE=1 to override.',
    );
  }
}

const adminEmail = process.env.RAKSS_ADMIN_EMAIL || 'admin@hrflow.lab.novadev.tech';
const adminPassword = process.env.RAKSS_ADMIN_PASSWORD;
const baseUrl = process.env.RAKSS_ADMIN_URL || 'http://localhost:5173';
assertLocalTarget('RAKSS_ADMIN_URL', baseUrl);
const executablePath = process.env.PLAYWRIGHT_MCP_EXECUTABLE_PATH || process.env.PLAYWRIGHT_CHROME;

await mkdir('output/playwright', { recursive: true });

if (!adminPassword) {
  await writeFile(
    'output/playwright/rakss-ui-lifecycle-proof.json',
    `${JSON.stringify({
      ok: false,
      blocked: true,
      reason: 'RAKSS_ADMIN_PASSWORD is required',
      baseUrl,
      adminEmail,
      checkedAt: new Date().toISOString(),
    }, null, 2)}\n`,
  );
  throw new Error('RAKSS_ADMIN_PASSWORD is required');
}

const sweepSource = await readFile(
  new URL('./rakss-ui-lifecycle-sweep.js', import.meta.url),
  'utf8',
);
const sweep = eval(sweepSource);
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('textbox', { name: 'Work email' }).fill(adminEmail);
  await page.getByRole('textbox', { name: 'Password' }).fill(adminPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(`${baseUrl}/`, { timeout: 30000 });

  const proof = await sweep(page);
  await writeFile(
    'output/playwright/rakss-ui-lifecycle-proof.json',
    `${JSON.stringify(proof, null, 2)}\n`,
  );
  console.log(JSON.stringify(proof, null, 2));
} finally {
  await browser.close();
}

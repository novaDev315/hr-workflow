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

const adminEmail = process.env.RAKSS_ADMIN_EMAIL || 'admin@rakss.lab.novadev.tech';
const adminPassword = process.env.RAKSS_ADMIN_PASSWORD;
const baseUrl = 'https://admin.rakss.lab.novadev.tech';

if (!adminPassword) {
  throw new Error('RAKSS_ADMIN_PASSWORD is required');
}

await mkdir('output/playwright', { recursive: true });

const sweepSource = await readFile(
  new URL('./rakss-ui-lifecycle-sweep.js', import.meta.url),
  'utf8',
);
const sweep = eval(sweepSource);
const browser = await chromium.launch({ headless: true });
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

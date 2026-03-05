/**
 * Feature Graphic (1024x500) Capture Script
 * Usage: node screenshots/playstore/capture-fg.mjs
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GRAPHICS = [
  { id: 'fg-en', file: 'feature_graphic_en.png' },
  { id: 'fg-ja', file: 'feature_graphic_ja.png' },
  { id: 'fg-ko', file: 'feature_graphic_ko.png' },
];

async function main() {
  const htmlPath = path.join(__dirname, 'feature-graphic.html');
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 600 } })).newPage();

  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  for (const { id, file } of GRAPHICS) {
    const outputPath = path.join(__dirname, file);
    console.log(`Capturing ${id} -> ${file}`);
    await page.locator(`#${id}`).screenshot({ path: outputPath, type: 'png' });
  }

  await browser.close();
  console.log('Done! Feature graphics saved.');
}

main().catch(console.error);

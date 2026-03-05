/**
 * Google Play Store Screenshot Capture Script
 * Uses Playwright to capture 1080x1920 screenshots from generator.html
 *
 * Usage: node screenshots/playstore/capture.mjs
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_IDS = [
  'en-1', 'en-2', 'en-3', 'en-4', 'en-5',
  'ja-1', 'ja-2', 'ja-3', 'ja-4', 'ja-5',
];

const NAMES = {
  'en-1': '01_ai_travel_planner',
  'en-2': '02_home_dashboard',
  'en-3': '03_create_trip',
  'en-4': '04_itinerary',
  'en-5': '05_features',
  'ja-1': '01_ai_travel_planner',
  'ja-2': '02_home_dashboard',
  'ja-3': '03_create_trip',
  'ja-4': '04_itinerary',
  'ja-5': '05_features',
};

async function main() {
  const htmlPath = path.join(__dirname, 'generator.html');
  const fileUrl = `file://${htmlPath}`;

  // Ensure output directories exist
  for (const lang of ['en', 'ja']) {
    const dir = path.join(__dirname, lang);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1920 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  console.log(`Loading ${fileUrl}`);
  await page.goto(fileUrl, { waitUntil: 'networkidle' });

  // Wait for fonts to load
  await page.waitForTimeout(2000);

  for (const id of SCREENSHOT_IDS) {
    const lang = id.split('-')[0];
    const name = NAMES[id];
    const outputPath = path.join(__dirname, lang, `${name}.png`);

    console.log(`Capturing ${id} -> ${lang}/${name}.png`);

    const element = page.locator(`#${id}`);
    await element.screenshot({
      path: outputPath,
      type: 'png',
    });
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to:');
  console.log(`  screenshots/playstore/en/ (5 files)`);
  console.log(`  screenshots/playstore/ja/ (5 files)`);
}

main().catch(console.error);

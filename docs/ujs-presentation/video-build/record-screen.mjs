/**
 * Automated EWUMS screen capture for client demo (silent video).
 * Run: node record-screen.mjs
 * Requires: npm install && npx playwright install chromium
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, 'narration-hindi.json'), 'utf8'));
const baseUrl = (process.env.DEMO_BASE_URL || config.baseUrl).replace(/\/$/, '');
const outDir = join(__dirname, 'output', 'screen-clips');

mkdirSync(outDir, { recursive: true });

async function login(page, { email, password }) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

async function recordScene(browser, scene) {
  const clipDir = join(outDir, scene.id);
  mkdirSync(clipDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: clipDir, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();

  try {
    await login(page, scene.login);
    const route = scene.route.startsWith('/') ? scene.route : `/${scene.route}`;
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(Math.min(scene.durationSec * 1000, 60000));
    // Slow scroll on long pages
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let y = 0;
        const step = () => {
          y += 120;
          window.scrollTo(0, y);
          if (y < document.body.scrollHeight) setTimeout(step, 400);
          else resolve();
        };
        step();
      });
    });
    await page.waitForTimeout(2000);
  } catch (err) {
    console.warn(`  Scene ${scene.id} warning:`, err.message);
  }

  await context.close();
  const video = (await import('fs')).readdirSync(clipDir).find((f) => f.endsWith('.webm'));
  if (video) {
    console.log(`  Screen: ${scene.id} -> ${join(clipDir, video)}`);
  }
  return clipDir;
}

async function main() {
  console.log(`Recording EWUMS demo from ${baseUrl}`);
  const browser = await chromium.launch({ headless: false });

  for (const scene of config.scenes) {
    console.log(`Scene ${scene.id}: ${scene.title}`);
    await recordScene(browser, scene);
  }

  await browser.close();
  console.log(`Screen clips saved under ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

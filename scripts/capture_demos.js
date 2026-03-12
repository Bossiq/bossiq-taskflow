import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const docsDir = join(__dirname, '..', 'docs');

if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir);
}

const SITE_URL = 'http://localhost:5173';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function capture() {
  console.log('🚀 Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 } // 4K resolution trick (Retina)
  });

  const page = await browser.newPage();
  console.log(`🌍 Navigating to ${SITE_URL}...`);
  
  try {
    await page.goto(SITE_URL, { waitUntil: 'networkidle0', timeout: 15000 });
  } catch (error) {
    console.warn('⚠️ NetworkIdle timeout, proceeding anyway...', error.message);
  }

  // 1. Check if we are on Auth page
  await delay(2000);
  const isAuth = await page.$('.auth-form-container');
  if (isAuth) {
    console.log('📸 Capturing Auth Page...');
    await page.screenshot({ path: join(docsDir, 'auth_screen.png'), fullPage: true });

    // Skip login to use the rich guest mock data
    console.log('🚪 Bypassing Auth via Guest Mode...');
    await page.click('.auth-skip');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
  } else {
    console.log('📸 Already logged in, capturing Auth Page later...');
  }

  await delay(2000); // Wait for board rendering

  // 2. Capture Dark Mode Board
  console.log('📸 Capturing Board (Dark Mode)...');
  await page.screenshot({ path: join(docsDir, 'screenshot.png') });

  // 3. Switch to Light Mode and Capture
  console.log('💡 Switching to Light Mode...');
  const themeToggle = await page.$('.theme-toggle');
  if (themeToggle) {
    await themeToggle.click();
    await delay(1000); // wait for CSS transition
    console.log('📸 Capturing Board (Light Mode)...');
    await page.screenshot({ path: join(docsDir, 'board_light.png') });
  }

  console.log('✅ Demo capture complete! Check the /docs folder.');
  await browser.close();
}

capture().catch(console.error);

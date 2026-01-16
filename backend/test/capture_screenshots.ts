import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs/promises';

async function capture() {
  const screenshotsDir = path.join(__dirname, '../../notes/week-2025-12-15/screenshots');
  await fs.mkdir(screenshotsDir, { recursive: true });

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  console.log('Logging in...');
  await page.goto('http://frontend:3001/login');
  await page.fill('input[type="email"]', 'test@test.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  console.log('Capturing Sidebar...');
  await page.screenshot({ path: path.join(screenshotsDir, '03_sidebar_navigation.png') });

  console.log('Capturing Profile Settings...');
  await page.goto('http://frontend:3001/settings/profile');
  await page.waitForSelector('h1:has-text("Account Settings")');
  await page.screenshot({ path: path.join(screenshotsDir, '01_profile_settings.png') });

  console.log('Testing Profile Update...');
  await page.fill('input[value="Test User"]', 'Test User Updated');
  await page.click('button:has-text("Save Changes")');
  await page.waitForSelector('text=Profile Updated');
  await page.screenshot({ path: path.join(screenshotsDir, '04_success_notification.png') });

  console.log('Capturing Notification Settings...');
  await page.goto('http://frontend:3001/settings/notifications');
  await page.waitForSelector('h1:has-text("Notification Settings")');
  await page.screenshot({ path: path.join(screenshotsDir, '02_notification_settings.png') });

  await browser.close();
  console.log('Screenshots captured successfully!');
}

capture().catch(console.error);

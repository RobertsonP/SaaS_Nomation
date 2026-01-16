const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  try {
    console.log('Navigating to login page...');
    await page.goto('http://frontend:3001/login', { waitUntil: 'networkidle', timeout: 10000 });
    console.log('Page title:', await page.title());
    const content = await page.content();
    console.log('Page content length:', content.length);
    if (content.includes('error')) {
      console.log('Error text found in content');
    }
  } catch (e) {
    console.log('Navigation failed:', e.message);
  } finally {
    await browser.close();
  }
})();

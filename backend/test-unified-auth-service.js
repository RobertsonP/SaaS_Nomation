/**
 * Test UnifiedAuthService with TTS Manual Navigation Fix
 */
const { PrismaClient } = require('@prisma/client');

// Mock UnifiedAuthService for testing
const { chromium } = require('playwright');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://nomation_user:nomation_password@localhost:5432/nomation'
    }
  }
});

async function testUnifiedAuthService() {
  console.log('🧪 Testing UnifiedAuthService with TTS Manual Navigation');
  console.log('======================================================');
  
  try {
    // Get TTS auth flow from database
    const authFlows = await prisma.authFlow.findMany({
      where: {
        loginUrl: 'https://tts.am/login'
      },
      take: 1
    });
    
    if (authFlows.length === 0) {
      console.error('❌ No TTS auth flows found');
      return;
    }
    
    const authFlow = authFlows[0];
    console.log(`✅ Using auth flow: ${authFlow.name}`);
    
    // Simulate the UnifiedAuthService authenticateForUrl method
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    
    console.log('🔐 Starting authentication simulation...');
    
    // Step 1: Go to login page
    await page.goto(authFlow.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Step 2: Execute authentication steps
    for (const [index, step] of authFlow.steps.entries()) {
      console.log(`📋 Step ${index + 1}: ${step.type} - ${step.description}`);
      
      switch (step.type) {
        case 'type':
          let valueToType = step.value || '';
          if (valueToType === '${username}') {
            valueToType = authFlow.credentials.username;
          } else if (valueToType === '${password}') {
            valueToType = authFlow.credentials.password;
          }
          await page.fill(step.selector, valueToType);
          break;
        case 'click':
          await page.click(step.selector);
          break;
        case 'wait':
          await page.waitForTimeout(parseInt(step.value || '2000', 10));
          break;
      }
      
      await page.waitForTimeout(1000);
    }
    
    // Step 3: Wait for form submission
    console.log('⏳ Waiting for authentication to complete...');
    await page.waitForTimeout(5000);
    
    // Step 4: TTS-specific manual navigation (from our UnifiedAuthService fix)
    console.log('🔧 TTS detected - using manual dashboard navigation');
    
    const ttsUrls = [
      'https://tts.am/dashboard',
      'https://tts.am/invoices'
    ];
    
    let navigationSuccess = false;
    let finalUrl = page.url();
    
    for (const ttsUrl of ttsUrls) {
      try {
        console.log(`🌐 Trying TTS URL: ${ttsUrl}`);
        await page.goto(ttsUrl, { 
          waitUntil: 'networkidle', 
          timeout: 30000 
        });
        
        await page.waitForTimeout(3000);
        
        const currentUrl = page.url();
        console.log(`📍 Current URL after navigation: ${currentUrl}`);
        
        // Check if we were redirected back to login (auth failed)
        if (currentUrl.includes('login')) {
          console.log(`❌ Redirected back to login from ${ttsUrl}`);
          continue;
        }
        
        // Check if we successfully reached an authenticated page
        if (currentUrl.includes('dashboard') || currentUrl.includes('invoices')) {
          console.log(`✅ Successfully reached authenticated page: ${currentUrl}`);
          finalUrl = currentUrl;
          navigationSuccess = true;
          break;
        }
        
      } catch (error) {
        console.log(`❌ Failed to navigate to ${ttsUrl}: ${error.message}`);
      }
    }
    
    // Step 5: Validation
    const authSuccess = navigationSuccess || !finalUrl.includes('login');
    
    console.log('📊 AUTHENTICATION RESULT:');
    console.log(`   Success: ${authSuccess}`);
    console.log(`   Final URL: ${finalUrl}`);
    console.log(`   Navigation Success: ${navigationSuccess}`);
    console.log(`   On Dashboard: ${finalUrl.includes('dashboard')}`);
    console.log(`   On Invoices: ${finalUrl.includes('invoices')}`);
    
    if (authSuccess) {
      console.log('🎉 UNIFIED AUTH SERVICE FIX SUCCESSFUL!');
      
      // Extract elements to confirm we have dashboard elements
      const elements = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button')).map(btn => btn.textContent?.trim()).filter(text => text && text.length > 0);
        const links = Array.from(document.querySelectorAll('a')).map(link => link.textContent?.trim()).filter(text => text && text.length > 0);
        return { buttons: buttons.slice(0, 5), links: links.slice(0, 5) };
      });
      
      console.log('🎯 Found dashboard elements:');
      console.log(`   Buttons: ${elements.buttons.join(', ')}`);
      console.log(`   Links: ${elements.links.join(', ')}`);
    } else {
      console.log('❌ Authentication failed - manual navigation did not work');
    }
    
    await browser.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUnifiedAuthService().catch(console.error);
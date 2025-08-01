/**
 * Test TTS Authentication using Database Auth Flows and LiveBrowserService
 * This script uses the actual system components to test authentication
 */
const { PrismaClient } = require('@prisma/client');
const { chromium } = require('playwright');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://nomation_user:nomation_password@localhost:5432/nomation'
    }
  }
});

async function testTTSAuthenticationWithDatabaseFlow() {
  console.log('🎭 TTS Authentication Test with Database Auth Flows');
  console.log('====================================================');
  
  try {
    // Step 1: Get TTS auth flow from database
    console.log('📊 Getting TTS auth flow from database...');
    const authFlows = await prisma.authFlow.findMany({
      where: {
        loginUrl: 'https://tts.am/login'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 1
    });
    
    if (authFlows.length === 0) {
      console.error('❌ No TTS auth flows found in database');
      return;
    }
    
    const authFlow = authFlows[0];
    console.log(`✅ Found auth flow: ${authFlow.name}`);
    console.log(`📍 Login URL: ${authFlow.loginUrl}`);
    console.log(`👤 Username: ${authFlow.credentials.username}`);
    console.log(`🔑 Password: ${authFlow.credentials.password.substring(0, 3)}***`);
    console.log(`🔧 Steps: ${authFlow.steps.length} steps`);
    
    // Step 2: Initialize browser with same settings as LiveBrowserService
    console.log('🚀 Launching browser...');
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();
    
    // Step 3: Navigate to login page
    console.log(`🌐 Navigating to: ${authFlow.loginUrl}`);
    await page.goto(authFlow.loginUrl, { 
      waitUntil: 'networkidle', 
      timeout: 30000 
    });
    
    // Take screenshot of login page
    await page.screenshot({ path: 'tts-login-page.png', fullPage: true });
    console.log('📸 Screenshot saved: tts-login-page.png');
    
    // Step 4: Execute auth steps with exact database selectors
    console.log('🔐 Executing authentication steps...');
    
    for (const [index, step] of authFlow.steps.entries()) {
      console.log(`📋 Step ${index + 1}: ${step.type} - ${step.description}`);
      console.log(`   Selector: ${step.selector}`);
      
      try {
        await executeAuthStep(page, step, authFlow.credentials);
        console.log(`   ✅ Step ${index + 1} completed successfully`);
        
        // Take screenshot after each step
        await page.screenshot({ 
          path: `tts-step-${index + 1}-${step.type}.png`, 
          fullPage: true 
        });
        
        // Wait between steps for stability
        await page.waitForTimeout(1000);
        
      } catch (stepError) {
        console.error(`   ❌ Step ${index + 1} failed:`, stepError.message);
        
        // Take error screenshot
        await page.screenshot({ 
          path: `tts-step-${index + 1}-error.png`, 
          fullPage: true 
        });
        
        // Check if element exists
        const elementExists = await page.$(step.selector).then(el => !!el);
        console.log(`   🔍 Element exists: ${elementExists}`);
        
        if (!elementExists) {
          console.log('   🔍 Available elements on page:');
          const elements = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input')).map(el => ({
              type: el.type,
              name: el.name,
              id: el.id,
              className: el.className,
              selector: el.id ? `#${el.id}` : (el.name ? `[name="${el.name}"]` : el.tagName.toLowerCase())
            }));
            const buttons = Array.from(document.querySelectorAll('button')).map(el => ({
              type: 'button',
              text: el.textContent?.trim(),
              id: el.id,
              className: el.className,
              selector: el.id ? `#${el.id}` : 'button'
            }));
            return { inputs, buttons };
          });
          console.log('   📝 Input elements:', elements.inputs);
          console.log('   🔘 Button elements:', elements.buttons);
        }
        
        throw stepError;
      }
    }
    
    // Step 5: Wait for authentication to complete
    console.log('⏳ Waiting for authentication to complete...');
    await page.waitForTimeout(5000); // Increased wait time
    
    // Step 6: Manual navigation to dashboard (headless browser fix)
    console.log('🔧 Manual navigation to dashboard (headless browser fix)...');
    const dashboardUrls = [
      'https://tts.am/dashboard',
      'https://tts.am/invoices'
    ];
    
    let dashboardSuccess = false;
    let finalUrl = page.url();
    
    for (const dashboardUrl of dashboardUrls) {
      try {
        console.log(`🌐 Trying to navigate to: ${dashboardUrl}`);
        await page.goto(dashboardUrl, { 
          waitUntil: 'networkidle', 
          timeout: 30000 
        });
        
        await page.waitForTimeout(3000); // Wait for page to load
        
        const currentUrl = page.url();
        console.log(`📍 Current URL after navigation: ${currentUrl}`);
        
        // Check if we were redirected back to login (authentication failed)
        if (currentUrl.includes('login')) {
          console.log(`❌ Redirected back to login from ${dashboardUrl}`);
          continue;
        }
        
        // Check if we successfully reached the dashboard
        if (currentUrl.includes('dashboard') || currentUrl.includes('invoices')) {
          console.log(`✅ Successfully reached authenticated page: ${currentUrl}`);
          finalUrl = currentUrl;
          dashboardSuccess = true;
          
          // Take screenshot of successful dashboard
          await page.screenshot({ 
            path: `tts-dashboard-${dashboardUrl.split('/').pop()}.png`, 
            fullPage: true 
          });
          console.log(`📸 Dashboard screenshot saved: tts-dashboard-${dashboardUrl.split('/').pop()}.png`);
          break;
        }
        
      } catch (error) {
        console.log(`❌ Failed to navigate to ${dashboardUrl}: ${error.message}`);
      }
    }
    
    if (!dashboardSuccess) {
      console.log('❌ Could not access any authenticated pages - authentication may have failed');
      finalUrl = page.url();
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'tts-final-page.png', fullPage: true });
    console.log('📸 Final screenshot saved: tts-final-page.png');
    
    console.log(`🎯 Final URL: ${finalUrl}`);
    
    // Check authentication status based on final URL
    const stillOnLogin = finalUrl.includes('login');
    const onDashboard = finalUrl.includes('dashboard');
    const onInvoices = finalUrl.includes('invoices');
    
    console.log(`🔍 Authentication Status Analysis:`);
    console.log(`   Still on login page: ${stillOnLogin}`);
    console.log(`   On dashboard page: ${onDashboard}`);
    console.log(`   On invoices page: ${onInvoices}`);
    console.log(`   Authentication successful: ${dashboardSuccess}`);
    
    if (stillOnLogin) {
      console.log('❌ Authentication failed - still on login page');
      
      // Check for error messages
      const errorMessages = await page.evaluate(() => {
        const errorSelectors = [
          '.error', '.alert', '.message', '[role="alert"]', 
          '.notification', '.toast', '.warning'
        ];
        const errors = [];
        for (const selector of errorSelectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const text = el.textContent?.trim();
            if (text && text.length > 0) {
              errors.push({ selector, text });
            }
          });
        }
        return errors;
      });
      
      if (errorMessages.length > 0) {
        console.log('🚨 Error messages found on page:');
        errorMessages.forEach(error => {
          console.log(`   ${error.selector}: ${error.text}`);
        });
      } else {
        console.log('🔍 No error messages found on page');
      }
    } else if (dashboardSuccess) {
      console.log('🎉 AUTHENTICATION SUCCESSFUL - Reached authenticated dashboard!');
      console.log(`✅ Successfully authenticated and navigated to: ${finalUrl}`);
    } else {
      console.log('⚠️ Unclear authentication status - not on login but dashboard access unclear');
    }
    
    // Step 7: Try to extract elements from current page
    console.log('🔍 Extracting elements from current page...');
    const elements = await page.evaluate(() => {
      const extractedElements = [];
      const selectors = [
        'button', 'input', 'textarea', 'select', 'a', 'form',
        '[role="button"]', '[role="link"]', '[role="textbox"]',
        '[data-testid]', '[aria-label]', '.btn', '.button'
      ];

      for (const selectorType of selectors) {
        const elements = document.querySelectorAll(selectorType);
        
        elements.forEach((element, index) => {
          if (element instanceof HTMLElement) {
            const rect = element.getBoundingClientRect();
            const styles = window.getComputedStyle(element);
            
            // Skip hidden elements
            if (rect.width === 0 || rect.height === 0 || styles.display === 'none') {
              return;
            }

            const text = element.textContent?.trim() || '';
            const ariaLabel = element.getAttribute('aria-label') || '';
            const placeholder = element.getAttribute('placeholder') || '';
            
            let description = text || ariaLabel || placeholder || `${element.tagName.toLowerCase()} element`;
            if (description.length > 50) {
              description = description.substring(0, 47) + '...';
            }

            extractedElements.push({
              tag: element.tagName.toLowerCase(),
              selector: element.id ? `#${element.id}` : selectorType,
              description,
              text: text.substring(0, 100),
              id: element.id || undefined,
              className: element.className || undefined
            });
          }
        });
      }

      return extractedElements.slice(0, 20); // Limit to first 20 elements
    });
    
    console.log(`🎯 Found ${elements.length} elements on current page:`);
    elements.forEach((element, index) => {
      console.log(`   ${index + 1}. ${element.tag} - ${element.description}`);
    });
    
    await browser.close();
    
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function executeAuthStep(page, step, credentials) {
  const timeout = 30000;

  switch (step.type) {
    case 'type':
      let valueToType = step.value || '';
      
      // Replace credential placeholders (same logic as UnifiedAuthService)
      if (valueToType === '${username}') {
        valueToType = credentials.username;
      } else if (valueToType === '${password}') {
        valueToType = credentials.password;
      }
      
      console.log(`   📝 Typing "${valueToType}" into ${step.selector}`);
      await page.fill(step.selector, valueToType, { timeout });
      break;

    case 'click':
      console.log(`   🖱️  Clicking ${step.selector}`);
      await page.click(step.selector, { timeout });
      break;

    case 'wait':
      const waitTime = parseInt(step.value || '2000', 10);
      console.log(`   ⏳ Waiting ${waitTime}ms`);
      await page.waitForTimeout(waitTime);
      break;

    default:
      throw new Error(`Unknown authentication step type: ${step.type}`);
  }
}

// Run the test
testTTSAuthenticationWithDatabaseFlow().catch(console.error);
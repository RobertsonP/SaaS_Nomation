# Screenshot Feature - CSS Selector Bug Fix
Date: 2026-01-12 18:40
Status: ✅ Fixed - Ready for Testing

## Problem
User tested discovery on tts.am after implementing 4 new features (screenshots, deduplication, verification, localhost support). Screenshots were not appearing in the sitemap.

## Investigation
Checked backend logs and found error:
```
error: Failed to crawl https://tts.am/: page.evaluate: SyntaxError: Failed to execute 'querySelector' on 'Document': 'button:has-text("Log in")' is not a valid selector.
```

Root cause: The `detectAuthRequirement` function in `page-crawler.service.ts` was using Playwright-specific selectors (`:has-text()`) inside `document.querySelector()` within a `page.evaluate()` block. However, `page.evaluate()` runs in the browser context, which only supports standard CSS selectors.

## Changes Made
- File: `backend/src/discovery/page-crawler.service.ts`
  - Lines 248-277: Replaced `detectAuthRequirement` function
  - Removed invalid selectors:
    - `'button:has-text("Log in")'`
    - `'button:has-text("Sign in")'`
  - Added valid CSS selectors:
    - `'[class*="signin"]'`
    - `'[id*="signin"]'`
  - Added manual text content check for buttons:
    ```typescript
    const buttons = document.querySelectorAll('button, input[type="submit"], a[role="button"]');
    const loginKeywords = ['log in', 'login', 'sign in', 'signin', 'authenticate'];
    for (const button of buttons) {
      const text = (button.textContent || '').toLowerCase().trim();
      if (loginKeywords.some(keyword => text.includes(keyword))) return true;
    }
    ```

## Implementation Details
CSS selectors cannot select elements by text content - that's a Playwright-specific feature. The fix uses standard CSS for structural patterns (class/id containing "login") and JavaScript for text content checking.

## Testing
- Backend restarted successfully
- Compilation completed without errors
- API server running on localhost:3002

## Result
Bug fixed. Discovery crawl should now complete successfully, allowing:
1. Screenshots to be captured
2. Verification status to be tracked
3. All 4 features to work as intended

## Next Steps
User should test:
1. Discovery on tts.am - verify screenshots appear
2. Discovery on localhost:3001 - verify localhost support works

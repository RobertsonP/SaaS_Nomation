import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import { DetectedElement } from './interfaces/element.interface';

interface InteractiveTrigger {
  selector: string;
  text: string;
  triggerType: 'modal' | 'dropdown' | 'popup' | 'expandable' | 'tab';
  ariaInfo?: string;
}

@Injectable()
export class InteractiveElementDiscoveryService {
  private readonly logger = new Logger(InteractiveElementDiscoveryService.name);

  /**
   * Discover elements hidden behind interactive triggers (modals, dropdowns, popups).
   * After the initial page scan, this service clicks triggers to reveal hidden elements.
   */
  async discoverHiddenElements(
    page: Page,
    initialElements: DetectedElement[],
    onProgress?: (message: string) => void,
  ): Promise<DetectedElement[]> {
    const discoveredElements: DetectedElement[] = [];

    try {
      // Step 1: Identify interactive triggers
      const triggers = await this.findInteractiveTriggers(page);
      if (triggers.length === 0) {
        this.logger.debug('No interactive triggers found on page');
        return [];
      }

      this.logger.log(`Found ${triggers.length} interactive triggers to check`);
      onProgress?.(`Checking ${triggers.length} interactive triggers...`);

      // Step 2: Get baseline element snapshot
      const baselineSelectors = new Set(initialElements.map(e => e.selector));

      // Step 3: Try each trigger (max 10)
      const triggersToCheck = triggers.slice(0, 10);
      for (const trigger of triggersToCheck) {
        try {
          const newElements = await this.tryTrigger(page, trigger, baselineSelectors);
          if (newElements.length > 0) {
            this.logger.log(`Trigger "${trigger.text}" revealed ${newElements.length} new elements`);
            onProgress?.(`Found ${newElements.length} elements in ${trigger.triggerType}`);
            discoveredElements.push(...newElements);
            // Add to baseline so we don't re-discover them
            newElements.forEach(e => baselineSelectors.add(e.selector));
          }
        } catch (err) {
          this.logger.debug(`Trigger "${trigger.text}" failed: ${err.message}`);
        }
      }

      this.logger.log(`Interactive discovery complete: ${discoveredElements.length} hidden elements found`);
    } catch (error) {
      this.logger.warn(`Interactive element discovery failed: ${error.message}`);
    }

    return discoveredElements;
  }

  /**
   * Find elements on the page that are likely to trigger modals, dropdowns, or popups
   */
  private async findInteractiveTriggers(page: Page): Promise<InteractiveTrigger[]> {
    return page.evaluate(() => {
      const triggers: Array<{
        selector: string;
        text: string;
        triggerType: 'modal' | 'dropdown' | 'popup' | 'expandable' | 'tab';
        ariaInfo?: string;
      }> = [];

      const seen = new Set<string>();

      // Helper to build a usable selector
      const getSelector = (el: Element): string | null => {
        if (el.id) return `#${CSS.escape(el.id)}`;
        const testId = el.getAttribute('data-testid');
        if (testId) return `[data-testid="${testId}"]`;
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return `[aria-label="${ariaLabel}"]`;
        // Fallback: tag + class combo
        const tag = el.tagName.toLowerCase();
        const classes = Array.from(el.classList).filter(c => !c.match(/^(active|hover|focus|open|show)/)).slice(0, 2);
        if (classes.length > 0) return `${tag}.${classes.join('.')}`;
        return null;
      };

      // 1. Modal triggers (aria-haspopup="dialog", data-toggle="modal", data-bs-toggle="modal")
      document.querySelectorAll(
        '[aria-haspopup="dialog"], [data-toggle="modal"], [data-bs-toggle="modal"], ' +
        '[data-bs-target*="modal"], [data-target*="modal"], [data-micromodal-trigger]'
      ).forEach(el => {
        const selector = getSelector(el);
        const text = el.textContent?.trim()?.slice(0, 50) || '';
        if (selector && !seen.has(selector)) {
          seen.add(selector);
          triggers.push({ selector, text, triggerType: 'modal', ariaInfo: el.getAttribute('aria-haspopup') || undefined });
        }
      });

      // 2. Dropdown triggers
      document.querySelectorAll(
        '[aria-haspopup="menu"], [aria-haspopup="listbox"], [role="combobox"], ' +
        '[data-toggle="dropdown"], [data-bs-toggle="dropdown"], ' +
        '[class*="dropdown-toggle"], [class*="select-trigger"]'
      ).forEach(el => {
        const selector = getSelector(el);
        const text = el.textContent?.trim()?.slice(0, 50) || '';
        if (selector && !seen.has(selector)) {
          seen.add(selector);
          triggers.push({ selector, text, triggerType: 'dropdown', ariaInfo: el.getAttribute('aria-haspopup') || undefined });
        }
      });

      // 3. Buttons with modal/popup-like text patterns
      document.querySelectorAll('button, [role="button"], a[href="#"]').forEach(el => {
        const text = el.textContent?.trim()?.toLowerCase() || '';
        const isActionTrigger = /^(register|sign up|add|create|new|open|show|edit|delete|remove|settings|configure|invite|import|export|upload)/i.test(text);
        if (!isActionTrigger) return;

        // Skip if it's a regular link that navigates
        if (el.tagName === 'A') {
          const href = el.getAttribute('href');
          if (href && href !== '#' && !href.startsWith('javascript:')) return;
        }

        const selector = getSelector(el);
        if (selector && !seen.has(selector)) {
          seen.add(selector);
          triggers.push({ selector, text: text.slice(0, 50), triggerType: 'popup' });
        }
      });

      // 4. Expandable/accordion triggers
      document.querySelectorAll(
        '[aria-expanded], [data-toggle="collapse"], [data-bs-toggle="collapse"], ' +
        '[class*="accordion-header"], [class*="collapsible"], [class*="expandable"]'
      ).forEach(el => {
        const expanded = el.getAttribute('aria-expanded');
        // Only trigger collapsed ones
        if (expanded === 'true') return;

        const selector = getSelector(el);
        const text = el.textContent?.trim()?.slice(0, 50) || '';
        if (selector && !seen.has(selector)) {
          seen.add(selector);
          triggers.push({ selector, text, triggerType: 'expandable' });
        }
      });

      // 5. Tab triggers — inactive tabs that reveal hidden tab panels
      document.querySelectorAll(
        '[role="tab"]:not([aria-selected="true"]), ' +
        '[data-bs-toggle="tab"]:not(.active), [data-toggle="tab"]:not(.active), ' +
        '.nav-tabs .nav-link:not(.active), .nav-pills .nav-link:not(.active), ' +
        '[role="tab"][aria-selected="false"]'
      ).forEach(el => {
        const selector = getSelector(el);
        const text = el.textContent?.trim()?.slice(0, 50) || '';
        if (selector && !seen.has(selector)) {
          seen.add(selector);
          triggers.push({ selector, text, triggerType: 'tab' });
        }
      });

      return triggers;
    });
  }

  /**
   * Click a trigger element, scan for new elements, then close the popup
   */
  private async tryTrigger(
    page: Page,
    trigger: InteractiveTrigger,
    baselineSelectors: Set<string>,
  ): Promise<DetectedElement[]> {
    const newElements: DetectedElement[] = [];

    // Save current state
    const currentUrl = page.url();

    // Click the trigger
    const element = page.locator(trigger.selector).first();
    const isVisible = await element.isVisible().catch(() => false);
    if (!isVisible) return [];

    await element.click({ timeout: 3000 });

    // Wait for new content to appear
    await page.waitForTimeout(800);

    // Safety: check we didn't navigate away
    if (page.url() !== currentUrl) {
      this.logger.debug(`Trigger "${trigger.text}" caused navigation, going back`);
      await page.goBack({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
      return [];
    }

    // Scan for new interactive elements in revealed content
    const revealedElements = await page.evaluate((triggerInfo: { text: string; triggerType: string }) => {
      const elements: Array<{
        selector: string;
        tag: string;
        text: string;
        type: string;
        role: string;
        ariaLabel: string;
        id: string;
        className: string;
        placeholder: string;
        name: string;
      }> = [];

      // Look for elements in modals, overlays, dropdowns, tab panels, and forms
      const containers = document.querySelectorAll(
        '.modal.show, .modal[style*="display: block"], [role="dialog"], [role="alertdialog"], ' +
        '.dropdown-menu.show, [class*="dropdown"][class*="open"], ' +
        '[class*="popup"][class*="open"], [class*="popup"][class*="show"], ' +
        '.popover.show, [role="listbox"], [role="menu"], ' +
        '[aria-expanded="true"] + *, [aria-expanded="true"] ~ *, ' +
        '[role="tabpanel"]:not([hidden]), .tab-pane.active, .tab-pane.show, ' +
        'form:not([style*="display: none"]), [role="form"]'
      );

      const processElement = (el: Element) => {
        const tag = el.tagName.toLowerCase();
        if (!['input', 'button', 'select', 'textarea', 'a', 'form', 'label'].includes(tag) &&
            !el.getAttribute('role')?.match(/button|link|checkbox|radio|textbox|combobox|form/)) {
          return;
        }

        // Build selector
        let selector = '';
        if (el.id) selector = `#${CSS.escape(el.id)}`;
        else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;
        else if (el.getAttribute('name')) selector = `${tag}[name="${el.getAttribute('name')}"]`;
        else if (el.getAttribute('aria-label')) selector = `[aria-label="${el.getAttribute('aria-label')}"]`;
        else {
          const classes = Array.from(el.classList).slice(0, 2);
          selector = classes.length > 0 ? `${tag}.${classes.join('.')}` : tag;
        }

        elements.push({
          selector,
          tag,
          text: el.textContent?.trim()?.slice(0, 100) || '',
          type: el.getAttribute('type') || '',
          role: el.getAttribute('role') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          id: el.id || '',
          className: el.className?.toString() || '',
          placeholder: (el as HTMLInputElement).placeholder || '',
          name: el.getAttribute('name') || '',
        });
      };

      if (containers.length > 0) {
        containers.forEach(container => {
          container.querySelectorAll('input, button, select, textarea, a, form, label, [role]').forEach(processElement);
        });
      } else {
        // Fallback: look for any newly visible elements (we'll filter against baseline)
        document.querySelectorAll('input, button, select, textarea').forEach(el => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0) {
            processElement(el);
          }
        });
      }

      return elements;
    }, { text: trigger.text, triggerType: trigger.triggerType });

    // Convert to DetectedElements, filtering out baseline
    for (const el of revealedElements) {
      if (baselineSelectors.has(el.selector)) continue;

      const elementType = this.inferElementType(el.tag, el.type, el.role);

      newElements.push({
        selector: el.selector,
        elementType,
        description: this.buildDescription(el, trigger),
        confidence: 0.7,
        discoveryState: trigger.triggerType === 'modal' ? 'modal' : trigger.triggerType === 'tab' ? 'tab' : 'after_interaction',
        discoveryTrigger: `Clicked "${trigger.text}"`,
        attributes: {
          tag: el.tag,
          role: el.role || undefined,
          'aria-label': el.ariaLabel || undefined,
          text: el.text || undefined,
          id: el.id || undefined,
          class: el.className || undefined,
          type: el.type || undefined,
          name: el.name || undefined,
          placeholder: el.placeholder || undefined,
        },
      });
    }

    // Close the popup — tabs and expandables don't need closing
    if (trigger.triggerType !== 'tab') {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);

      // Verify popup closed — if not, try clicking outside
      const stillOpen = await page.evaluate(() => {
        return !!document.querySelector(
          '.modal.show, .modal[style*="display: block"], [role="dialog"]:not([aria-hidden="true"])'
        );
      });

      if (stillOpen) {
        // Try clicking a close button
        const closeBtn = page.locator('.modal .close, .modal [aria-label="Close"], [class*="modal"] button:has-text("Close"), [class*="modal"] button:has-text("×")').first();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(300);
        } else {
          // Click the overlay/backdrop
          await page.mouse.click(10, 10);
          await page.waitForTimeout(300);
        }
      }
    }

    return newElements;
  }

  private inferElementType(
    tag: string,
    type: string,
    role: string,
  ): DetectedElement['elementType'] {
    if (tag === 'button' || role === 'button') return 'button';
    if (tag === 'input') {
      if (type === 'submit' || type === 'button') return 'button';
      return 'input';
    }
    if (tag === 'select' || role === 'combobox' || role === 'listbox') return 'dropdown';
    if (tag === 'textarea' || role === 'textbox') return 'input';
    if (tag === 'a' || role === 'link') return 'link';
    if (role === 'checkbox') return 'input';
    if (role === 'radio') return 'input';
    return 'element';
  }

  private buildDescription(
    el: { tag: string; text: string; type: string; role: string; ariaLabel: string; placeholder: string; name: string },
    trigger: InteractiveTrigger,
  ): string {
    const label = el.ariaLabel || el.placeholder || el.text || el.name || el.type || el.tag;
    const contextMap: Record<string, string> = {
      modal: 'modal',
      dropdown: 'dropdown',
      popup: 'popup',
      expandable: 'expandable section',
      tab: 'tab',
    };
    const context = contextMap[trigger.triggerType] || trigger.triggerType;
    return `${label} (in ${context}: "${trigger.text}")`.slice(0, 200);
  }
}

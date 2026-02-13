/** Generate Playwright assertion code for table cells, rows, and columns */

export function cellTextAssertion(selector: string, expectedText: string): string {
  return `await expect(page.locator('${escape(selector)}')).toHaveText('${escape(expectedText)}');`;
}

export function cellContainsAssertion(selector: string, expectedText: string): string {
  return `await expect(page.locator('${escape(selector)}')).toContainText('${escape(expectedText)}');`;
}

export function cellVisibleAssertion(selector: string): string {
  return `await expect(page.locator('${escape(selector)}')).toBeVisible();`;
}

export function rowCountAssertion(tableSelector: string, expectedCount: number, hasTbody: boolean): string {
  const rowSelector = hasTbody ? `${tableSelector} tbody tr` : `${tableSelector} tr`;
  return `await expect(page.locator('${escape(rowSelector)}')).toHaveCount(${expectedCount});`;
}

export function columnHeaderAssertion(selector: string, expectedText: string): string {
  return `await expect(page.locator('${escape(selector)}')).toHaveText('${escape(expectedText)}');`;
}

function escape(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

import { escapeCSSSelector, getElementType } from '../../src/ai/element-selectors.utils';

describe('Element Selectors Utils', () => {
  
  describe('escapeCSSSelector', () => {
    it('should escape special characters', () => {
      const input = 'foo.bar[baz]';
      const expected = 'foo\\.bar\\[baz\\]';
      expect(escapeCSSSelector(input)).toBe(expected);
    });

    it('should return empty string for null/undefined', () => {
      expect(escapeCSSSelector('')).toBe('');
    });
  });

  describe('getElementType', () => {
    it('should identify buttons correctly', () => {
      const mockElement = {
        getAttribute: (attr: string) => attr === 'type' ? 'button' : null
      } as any;
      expect(getElementType('button', mockElement)).toBe('button');
    });

    it('should identify inputs correctly', () => {
      const mockElement = {
        getAttribute: () => null
      } as any;
      expect(getElementType('input', mockElement)).toBe('input');
    });

    it('should identify text elements', () => {
      const mockElement = {
        getAttribute: () => null
      } as any;
      expect(getElementType('h1', mockElement)).toBe('text');
    });
  });
});

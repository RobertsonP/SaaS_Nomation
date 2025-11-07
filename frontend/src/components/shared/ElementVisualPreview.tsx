import React from 'react';
import { ProjectElement } from '../../types/element.types';

interface ElementVisualPreviewProps {
  element: ProjectElement;
  className?: string;
}

export function ElementVisualPreview({ element, className = '' }: ElementVisualPreviewProps) {
  const visualData = element.attributes?.visualData;

  // Fallback: if no visualData, try to use screenshot
  if (!visualData) {
    if (element.screenshot) {
      return (
        <div className={`bg-gray-100 p-3 rounded flex items-center justify-center ${className}`}>
          <img
            src={element.screenshot}
            alt={element.description}
            className="max-w-full max-h-20 object-contain"
          />
        </div>
      );
    }

    // No visual data at all - show placeholder
    return (
      <div className={`bg-gray-100 p-3 rounded flex items-center justify-center text-gray-400 ${className}`}>
        <span className="text-sm">No preview available</span>
      </div>
    );
  }

  // Image type: render thumbnail
  if (visualData.type === 'image' && visualData.thumbnailBase64) {
    return (
      <div className={`bg-gray-100 p-3 rounded flex items-center justify-center ${className}`}>
        <img
          src={visualData.thumbnailBase64}
          alt={element.description}
          className="max-w-full max-h-20 object-contain"
        />
      </div>
    );
  }

  // CSS type: recreate element appearance with SMART scaling
  if (visualData.type === 'css') {
    const { layout, colors, typography, spacing, borders, effects, content } = visualData;

    // Smart preview rendering - fixed scale for consistency
    const PREVIEW_SCALE = 0.7; // 70% size - readable but fits in card
    const PREVIEW_MAX_WIDTH = 160; // Allow more horizontal space
    const MIN_FONT_SIZE = 11; // Ensure text readability

    // Calculate font size with minimum enforcement
    const originalFontSize = typography?.fontSize ? parseInt(typography.fontSize) : 14;
    const scaledFontSize = Math.max(MIN_FONT_SIZE, originalFontSize * PREVIEW_SCALE);

    // Ensure visible background color
    const bgColor = colors?.backgroundColor && colors.backgroundColor !== 'transparent' && colors.backgroundColor !== 'rgba(0, 0, 0, 0)'
      ? colors.backgroundColor
      : '#f3f4f6'; // Light gray fallback for visibility

    // Ensure visible text color
    const textColor = colors?.color && colors.color !== 'transparent' && colors.color !== 'rgba(0, 0, 0, 0)'
      ? colors.color
      : '#1f2937'; // Dark gray fallback

    return (
      <div className={`bg-white p-2 rounded border border-gray-200 flex items-center justify-center min-h-[50px] ${className}`}>
        <div
          style={{
            backgroundColor: bgColor,
            color: textColor,
            fontSize: `${scaledFontSize}px`,
            fontWeight: typography?.fontWeight || 'normal',
            fontFamily: typography?.fontFamily || 'inherit',
            textAlign: (typography?.textAlign as any) || 'center',
            padding: spacing?.padding || '6px 12px',
            border: borders?.border || '1px solid #e5e7eb',
            borderRadius: borders?.borderRadius || '4px',
            boxShadow: effects?.boxShadow || 'none',
            opacity: effects?.opacity || '1',
            maxWidth: `${PREVIEW_MAX_WIDTH}px`,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '28px', // Ensure buttons are visible
            minWidth: '50px' // Ensure elements aren't crushed
          }}
        >
          {content?.innerText || element.description}
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className={`bg-gray-100 p-3 rounded flex items-center justify-center text-gray-400 ${className}`}>
      <span className="text-sm">Preview not available</span>
    </div>
  );
}

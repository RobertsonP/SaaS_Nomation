import React, { useState } from 'react';
import { ProjectElement } from '../../types/element.types';
import { api } from '../../lib/api';

interface ElementVisualPreviewProps {
  element: ProjectElement;
  className?: string;
  onUpdate?: (updatedElement: ProjectElement) => void;
}

// === HELPER FUNCTIONS FOR ADAPTIVE SCALING ===

// Calculate optimal scale to fit element within container while maintaining aspect ratio
function calculateOptimalScale(
  originalWidth: number,
  originalHeight: number,
  containerWidth: number,
  containerHeight: number
): number {
  if (originalWidth <= 0 || originalHeight <= 0) return 1;
  const scaleX = containerWidth / originalWidth;
  const scaleY = containerHeight / originalHeight;
  return Math.min(scaleX, scaleY, 1); // Never scale UP, only down
}

// Scale spacing values (e.g., "8px 16px") proportionally
function scaleSpacing(spacing: string | undefined, scale: number): string {
  if (!spacing) return `${Math.round(4 * scale)}px`;

  const values = spacing.split(' ').map(v => {
    const num = parseFloat(v);
    if (isNaN(num)) return v;
    return `${Math.round(num * scale)}px`;
  });
  return values.join(' ');
}

// Scale border radius proportionally
function scaleBorderRadius(radius: string | undefined, scale: number): string {
  if (!radius) return `${Math.round(4 * scale)}px`;

  const num = parseFloat(radius);
  if (isNaN(num)) return radius;
  return `${Math.round(num * scale)}px`;
}

// Get icon for element type
function getElementTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    button: '🔘',
    input: '📝',
    link: '🔗',
    form: '📋',
    navigation: '🧭',
    text: '📄',
    image: '🖼️'
  };
  return icons[type] || '📦';
}

export function ElementVisualPreview({ element, className = '', onUpdate }: ElementVisualPreviewProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const visualData = element.attributes?.visualData;

  const handleCapture = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection

    // Validate required fields
    if (!element.projectId) {
      alert('Cannot capture screenshot: projectId missing');
      return;
    }

    try {
      setIsCapturing(true);

      // FIXED: Use correct endpoint with projectId
      const response = await api.post(
        `/projects/${element.projectId}/element/${element.id}/screenshot`,
        {
          selector: element.selector,
          url: element.sourceUrl?.url || ''
        }
      );

      if (response.data && response.data.screenshot) {
        setCapturedImage(response.data.screenshot);

        // Notify parent of update if callback provided
        if (onUpdate) {
          onUpdate({
            ...element,
            screenshot: response.data.screenshot,
            attributes: {
              ...element.attributes,
              visualData: {
                ...element.attributes?.visualData,
                type: 'image',
                thumbnailBase64: response.data.screenshot
              }
            }
          });
        }
      }
    } catch (error: any) {
      console.error('Failed to capture screenshot:', error);
      const errorMsg = error.response?.data?.message || 'Failed to capture screenshot';
      alert(`${errorMsg}. Please ensure the backend is running.`);
    } finally {
      setIsCapturing(false);
    }
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection
    setIsPreviewOpen(true);
  };

  const renderContent = () => {
    // Priority 1: Newly captured image
    if (capturedImage) {
      return (
        <img
          src={capturedImage}
          alt={element.description}
          className="max-w-full max-h-20 object-contain"
        />
      );
    }

    // Priority 2: Visual Data Image
    if (visualData?.type === 'image' && visualData.thumbnailBase64) {
      return (
        <img
          src={visualData.thumbnailBase64}
          alt={element.description}
          className="max-w-full max-h-20 object-contain"
        />
      );
    }

    // Priority 3: Legacy Screenshot
    if (element.screenshot) {
      return (
        <img
          src={element.screenshot}
          alt={element.description}
          className="max-w-full max-h-20 object-contain"
        />
      );
    }

    // Priority 4: CSS Mockup with ADAPTIVE SCALING
    if (visualData?.type === 'css') {
      const { layout, colors, typography, spacing, borders, effects, content } = visualData;

      // Container bounds for card preview
      const CONTAINER_MAX_WIDTH = 180;
      const CONTAINER_MAX_HEIGHT = 55;
      const MIN_FONT_SIZE = 9;

      // Extract original dimensions from visualData.layout
      const originalWidth = parseFloat(layout?.width || '120');
      const originalHeight = parseFloat(layout?.height || '36');

      // Calculate adaptive scale based on original element size
      const scale = calculateOptimalScale(originalWidth, originalHeight, CONTAINER_MAX_WIDTH, CONTAINER_MAX_HEIGHT);

      // Apply scaled dimensions
      const scaledWidth = Math.min(originalWidth * scale, CONTAINER_MAX_WIDTH);
      const scaledHeight = Math.min(originalHeight * scale, CONTAINER_MAX_HEIGHT);
      const originalFontSize = parseFloat(typography?.fontSize || '14');
      const scaledFontSize = Math.max(MIN_FONT_SIZE, originalFontSize * scale);

      // Color handling with fallbacks
      const bgColor = colors?.backgroundColor && colors.backgroundColor !== 'transparent' && colors.backgroundColor !== 'rgba(0, 0, 0, 0)'
        ? colors.backgroundColor
        : '#f3f4f6';
      const textColor = colors?.color && colors.color !== 'transparent' && colors.color !== 'rgba(0, 0, 0, 0)'
        ? colors.color
        : '#1f2937';

      return (
        <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center min-h-[50px] w-full">
          <div
            style={{
              // Use scaled dimensions from original element
              width: `${scaledWidth}px`,
              height: `${scaledHeight}px`,

              // Colors
              backgroundColor: bgColor,
              color: textColor,

              // Scaled typography
              fontSize: `${scaledFontSize}px`,
              fontWeight: typography?.fontWeight || 'normal',
              fontFamily: typography?.fontFamily || 'inherit',
              textAlign: (typography?.textAlign as any) || 'center',

              // Scaled spacing and borders
              padding: scaleSpacing(spacing?.padding, scale),
              border: borders?.border || '1px solid #e5e7eb',
              borderRadius: scaleBorderRadius(borders?.borderRadius, scale),

              // Effects
              boxShadow: effects?.boxShadow || 'none',
              opacity: effects?.opacity || '1',

              // Layout
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box'
            }}
            title={content?.innerText || element.description}
          >
            {content?.innerText || element.description}
          </div>
        </div>
      );
    }

    // Fallback
    return <span className="text-sm text-gray-400">No preview</span>;
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Element Type Badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">Preview</span>
        <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded capitalize flex items-center gap-1">
          <span>{getElementTypeIcon(element.elementType)}</span>
          {element.elementType}
        </span>
      </div>

      {/* Preview Area */}
      <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded flex items-center justify-center min-h-[70px] max-h-[80px] overflow-hidden">
        {renderContent()}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={handlePreviewClick}
          className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
          title="View Details"
        >
          👁️ Preview
        </button>
        <button
          onClick={handleCapture}
          disabled={isCapturing}
          className={`px-2 py-1 text-xs text-white rounded transition-colors ${
            isCapturing ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'
          }`}
          title="Capture Screenshot"
        >
          {isCapturing ? '⏳' : '📸'} Capture
        </button>
      </div>

      {/* Modal */}
      {isPreviewOpen && (
        <ElementPreviewModal 
          element={element} 
          image={capturedImage || (visualData?.type === 'image' ? visualData.thumbnailBase64 : element.screenshot)}
          onClose={() => setIsPreviewOpen(false)} 
        />
      )}
    </div>
  );
}

// Inline Modal Component
function ElementPreviewModal({ element, image, onClose }: { element: ProjectElement; image?: string | null; onClose: () => void }) {
  const visualData = element.attributes?.visualData;

  // Render CSS mockup for CSS-type elements (Modal version - larger)
  const renderCSSMockup = () => {
    if (visualData?.type !== 'css') return null;

    const { layout, colors, typography, spacing, borders, effects, content } = visualData;

    // Modal container has more space - use larger bounds
    const MODAL_MAX_WIDTH = 280;
    const MODAL_MAX_HEIGHT = 100;
    const MIN_FONT_SIZE = 10;

    // Extract original dimensions
    const originalWidth = parseFloat(layout?.width || '120');
    const originalHeight = parseFloat(layout?.height || '36');

    // Calculate adaptive scale for modal (larger container)
    const scale = calculateOptimalScale(originalWidth, originalHeight, MODAL_MAX_WIDTH, MODAL_MAX_HEIGHT);

    // Apply scaled dimensions
    const scaledWidth = Math.min(originalWidth * scale, MODAL_MAX_WIDTH);
    const scaledHeight = Math.min(originalHeight * scale, MODAL_MAX_HEIGHT);
    const originalFontSize = parseFloat(typography?.fontSize || '14');
    const scaledFontSize = Math.max(MIN_FONT_SIZE, originalFontSize * scale);

    const bgColor = colors?.backgroundColor && colors.backgroundColor !== 'transparent' && colors.backgroundColor !== 'rgba(0, 0, 0, 0)'
      ? colors.backgroundColor
      : '#f3f4f6';
    const textColor = colors?.color && colors.color !== 'transparent' && colors.color !== 'rgba(0, 0, 0, 0)'
      ? colors.color
      : '#1f2937';

    return (
      <div className="bg-white p-4 rounded border border-gray-200 flex items-center justify-center w-full">
        <div
          style={{
            // Scaled dimensions
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`,

            // Colors
            backgroundColor: bgColor,
            color: textColor,

            // Scaled typography
            fontSize: `${scaledFontSize}px`,
            fontWeight: typography?.fontWeight || 'normal',
            fontFamily: typography?.fontFamily || 'inherit',
            textAlign: (typography?.textAlign as any) || 'center',

            // Scaled spacing and borders
            padding: scaleSpacing(spacing?.padding, scale),
            border: borders?.border || '1px solid #e5e7eb',
            borderRadius: scaleBorderRadius(borders?.borderRadius, scale),

            // Effects
            boxShadow: effects?.boxShadow || 'none',
            opacity: effects?.opacity || '1',

            // Layout
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box'
          }}
          title={content?.innerText || element.description}
        >
          {content?.innerText || element.description}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Element Details</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">&times;</button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Image/Preview */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">Visual Preview</h4>
              <div className="border rounded p-4 flex items-center justify-center bg-gray-100 min-h-[200px]">
                {image ? (
                  <img src={image} alt="Preview" className="max-w-full object-contain" />
                ) : visualData?.type === 'css' ? (
                  renderCSSMockup()
                ) : (
                  <div className="text-gray-400 text-center">
                    <p>No screenshot available</p>
                    <p className="text-xs mt-1">Click "Capture" to take a screenshot</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Details */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Description</h4>
                <p className="text-gray-900">{element.description}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Selector</h4>
                <div className="bg-gray-800 text-green-400 p-3 rounded font-mono text-sm break-all">
                  {element.selector}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Type</h4>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                    {element.elementType}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Confidence</h4>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    (element.confidence || 0) >= 0.8 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {((element.confidence || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {element.attributes?.visualData?.type === 'css' && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Detected Attributes</h4>
                  <div className="bg-gray-50 p-2 rounded text-xs text-gray-600 font-mono space-y-1">
                    <p>Color: {element.attributes.visualData.colors?.color}</p>
                    <p>Bg: {element.attributes.visualData.colors?.backgroundColor}</p>
                    <p>Font: {element.attributes.visualData.typography?.fontFamily}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


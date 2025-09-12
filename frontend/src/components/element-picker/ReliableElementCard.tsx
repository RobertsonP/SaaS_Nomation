import { useState } from 'react';
import { ElementPreview } from './ElementPreview';

interface ReliableElementCardProps {
  element: {
    id: string;
    tagName: string;
    selector: string;
    text: string;
    description: string;
    elementType: string;
    confidence: number;
    fallbackSelectors?: string[];
    automationMetadata?: {
      priority: number;
      reliability: number;
      browserCompatibility: number;
      uniqueness: number;
      stability: number;
      xpath: string;
      validatedSelectors: any[];
    };
  };
  onRemove: (id: string) => void;
  className?: string;
}

export function ReliableElementCard({ element, onRemove, className = '' }: ReliableElementCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const getReliabilityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-100';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };
  
  const getReliabilityLabel = (score: number) => {
    if (score >= 0.9) return 'Excellent';
    if (score >= 0.8) return 'Very Good';
    if (score >= 0.7) return 'Good';
    if (score >= 0.6) return 'Fair';
    return 'Needs Review';
  };
  
  const getPriorityColor = (priority: number) => {
    if (priority >= 80) return 'text-green-600 bg-green-100';
    if (priority >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };
  
  // 🎯 NEW: CSS Selector Complexity Analysis
  const analyzeSelectorComplexity = (selector: string) => {
    const analysis = {
      tier: 1,
      complexity: 'Simple',
      cssFeatures: [] as string[],
      automationReadiness: 'Excellent',
      color: 'green' as keyof typeof colorMap,
      icon: '✅'
    };
    
    // Analyze CSS features used
    if (selector.includes('[data-testid') || selector.includes('[data-test') || selector.includes('[data-cy')) {
      analysis.cssFeatures.push('Test Attributes');
      analysis.tier = 1;
      analysis.complexity = 'Test-Optimized';
      analysis.automationReadiness = 'Excellent';
      analysis.color = 'green';
      analysis.icon = '🎯';
    } else if (selector.includes('[aria-') || selector.includes('[role=')) {
      analysis.cssFeatures.push('ARIA/Accessibility');
      analysis.tier = 2;
      analysis.complexity = 'Semantic';
      analysis.automationReadiness = 'Very Good';
      analysis.color = 'emerald';
      analysis.icon = '♿';
    } else if (selector.includes(':enabled') || selector.includes(':not(') || selector.includes(':valid')) {
      analysis.cssFeatures.push('State Pseudo-classes');
      analysis.tier = 2;
      analysis.complexity = 'Advanced';
      analysis.automationReadiness = 'Good';
      analysis.color = 'blue';
      analysis.icon = '⚡';
    } else if (selector.includes(':nth-') || selector.includes(':first-') || selector.includes(':last-')) {
      analysis.cssFeatures.push('Structural Pseudo-classes');
      analysis.tier = 3;
      analysis.complexity = 'Positional';
      analysis.automationReadiness = 'Fair';
      analysis.color = 'yellow';
      analysis.icon = '📍';
    } else if (selector.includes(':has-text') || selector.includes(':text-is')) {
      analysis.cssFeatures.push('Text Selectors');
      analysis.tier = 3;
      analysis.complexity = 'Content-based';
      analysis.automationReadiness = 'Good';
      analysis.color = 'purple';
      analysis.icon = '📝';
    }
    
    // Add more features based on complexity
    if (selector.includes('[') && selector.includes('=')) {
      analysis.cssFeatures.push('Attribute Selectors');
    }
    if (selector.includes('^=') || selector.includes('$=') || selector.includes('*=')) {
      analysis.cssFeatures.push('Advanced Attributes');
    }
    if (selector.includes(':is(') || selector.includes(':where(') || selector.includes(':has(')) {
      analysis.cssFeatures.push('CSS4 Selectors');
      analysis.tier = 2;
      analysis.complexity = 'Modern CSS';
      analysis.color = 'indigo';
      analysis.icon = '🚀';
    }
    
    // Calculate overall complexity
    const selectorLength = selector.length;
    const pseudoCount = (selector.match(/:/g) || []).length;
    const attributeCount = (selector.match(/\[/g) || []).length;
    
    if (selectorLength > 100 || pseudoCount > 3 || attributeCount > 2) {
      analysis.tier = Math.max(analysis.tier, 4);
      analysis.complexity = 'Complex';
      analysis.automationReadiness = 'Needs Review';
      analysis.color = 'red';
      analysis.icon = '⚠️';
    }
    
    return analysis;
  };
  
  const getTierColor = (tier: number) => {
    switch (tier) {
      case 1: return 'text-green-700 bg-green-100 border-green-200';
      case 2: return 'text-blue-700 bg-blue-100 border-blue-200';
      case 3: return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 4: return 'text-red-700 bg-red-100 border-red-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };
  
  const colorMap = {
    'green': 'text-green-700 bg-green-100',
    'emerald': 'text-emerald-700 bg-emerald-100',
    'blue': 'text-blue-700 bg-blue-100',
    'indigo': 'text-indigo-700 bg-indigo-100',
    'purple': 'text-purple-700 bg-purple-100',
    'yellow': 'text-yellow-700 bg-yellow-100',
    'red': 'text-red-700 bg-red-100'
  } as const;
  
  const getComplexityBadgeColor = (color: keyof typeof colorMap) => {
    return colorMap[color] || 'text-gray-700 bg-gray-100';
  };
  
  const automationScore = element.automationMetadata?.reliability || element.confidence;
  const priority = element.automationMetadata?.priority || 50;
  const complexityAnalysis = analyzeSelectorComplexity(element.selector);
  
  return (
    <div className={`border border-gray-200 rounded-lg p-3 bg-white hover:shadow-md transition-shadow ${className}`}>
      {/* Header - Clear and organized */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
              {element.elementType}
            </span>
            <span className="text-xs text-gray-500 font-mono">&lt;{element.tagName}&gt;</span>
            
            {/* Automation Quality Badge */}
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getReliabilityColor(automationScore)}`}>
              {getReliabilityLabel(automationScore)}
            </span>
            
            {/* Complexity Indicator - Simplified */}
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getTierColor(complexityAnalysis.tier)}`} 
                  title={`${complexityAnalysis.complexity} - ${complexityAnalysis.automationReadiness}`}>
              {complexityAnalysis.icon} {complexityAnalysis.complexity}
            </span>
          </div>
          
          <p className="text-sm text-gray-900 font-medium truncate" title={element.description}>
            {element.description}
          </p>
          
          {element.text && (
            <p className="text-xs text-gray-600 mt-1 truncate" title={element.text}>
              "{element.text}"
            </p>
          )}
        </div>
        
        <button
          onClick={() => onRemove(element.id)}
          className="ml-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
          title="Remove element"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Primary Selector - Clean layout */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">CSS Selector:</span>
          <div className="flex items-center space-x-2">
            {element.automationMetadata && (
              <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(priority)}`}>
                Priority: {priority}
              </span>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(element.selector)}
              className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
              title="Copy selector"
            >
              📋 Copy
            </button>
          </div>
        </div>
        <code className="block text-sm bg-gray-100 p-3 rounded border font-mono break-all">
          {element.selector}
        </code>
        
        {/* CSS Features - Cleaned up */}
        {complexityAnalysis.cssFeatures.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {complexityAnalysis.cssFeatures.map((feature, index) => (
              <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-200 text-gray-700">
                {feature}
              </span>
            ))}
          </div>
        )}
      </div>
      
      {/* Visual Element Preview - NEW! */}
      <ElementPreview 
        element={{
          ...element,
          attributes: {
            text: element.text,
            tagName: element.tagName,
            id: '',
            className: '',
            'aria-label': '',
            placeholder: '',
            type: '',
            href: '',
            'data-testid': '',
            cssInfo: {
              backgroundColor: 'transparent',
              color: '#374151',
              fontSize: '14px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 'normal',
              padding: '8px 12px',
              margin: '0px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              width: 'auto',
              height: 'auto',
              display: 'block',
              isVisible: true,
              hasBackground: false,
              hasText: element.text.length > 0,
              isStyled: false,
            },
            boundingRect: {
              x: 0,
              y: 0,
              width: 100,
              height: 40
            }
          }
        }} 
        className="mb-3" 
      />
      
      {/* Automation Scores - Clean grid */}
      {element.automationMetadata && (
        <div className="mb-3">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Automation Quality</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Browser Support:</span>
              <span className={`font-medium ${getReliabilityColor(element.automationMetadata.browserCompatibility)}`}>
                {Math.round(element.automationMetadata.browserCompatibility * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Stability:</span>
              <span className={`font-medium ${getReliabilityColor(element.automationMetadata.stability)}`}>
                {Math.round(element.automationMetadata.stability * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Uniqueness:</span>
              <span className={`font-medium ${getReliabilityColor(element.automationMetadata.uniqueness)}`}>
                {Math.round(element.automationMetadata.uniqueness * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Overall Score:</span>
              <span className={`font-medium ${getReliabilityColor(element.automationMetadata.reliability)}`}>
                {Math.round(element.automationMetadata.reliability * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Expandable Details - COMPRESSED */}
      <div className="border-t pt-1">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center justify-between w-full text-xs text-gray-600 hover:text-gray-800"
        >
          <span>
            {showDetails ? 'Hide' : 'Show'} Fallback Selectors 
            {element.fallbackSelectors && ` (${element.fallbackSelectors.length})`}
          </span>
          <svg 
            className={`w-3 h-3 transform transition-transform ${showDetails ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showDetails && (
          <div className="mt-2 space-y-2">
            {element.fallbackSelectors && element.fallbackSelectors.length > 0 ? (
              element.fallbackSelectors.slice(0, 5).map((selector, index) => (
                <div key={index} className="flex items-center justify-between">
                  <code className="text-xs bg-gray-50 p-1 rounded flex-1 mr-2 font-mono break-all">
                    {selector}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(selector)}
                    className="text-xs text-blue-600 hover:text-blue-800 flex-shrink-0"
                    title="Copy fallback selector"
                  >
                    📋
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 italic">No fallback selectors available</p>
            )}
            
            {element.automationMetadata?.xpath && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">XPath (Ultimate Fallback):</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(element.automationMetadata!.xpath)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                    title="Copy XPath"
                  >
                    📋
                  </button>
                </div>
                <code className="block text-xs bg-yellow-50 p-1 rounded border font-mono break-all">
                  {element.automationMetadata.xpath}
                </code>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
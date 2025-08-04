import { useState, useCallback, useEffect } from 'react';
import { SelectorValidationResult, ProjectElement } from '../../types/element.types';
import { QualityIndicator } from './QualityIndicator';
import { projectsAPI } from '../../lib/api';

interface SelectorValidationPanelProps {
  projectId: string;
  initialSelector?: string;
  onValidationComplete?: (result: SelectorValidationResult) => void;
  onSelectorSelect?: (selector: string) => void;
  className?: string;
}

export function SelectorValidationPanel({
  projectId,
  initialSelector = '',
  onValidationComplete,
  onSelectorSelect,
  className = ''
}: SelectorValidationPanelProps) {
  const [selector, setSelector] = useState(initialSelector);
  const [validationResult, setValidationResult] = useState<SelectorValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationMode, setValidationMode] = useState<'single' | 'cross-page'>('single');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Debounced validation
  const [validationTimeout, setValidationTimeout] = useState<NodeJS.Timeout | null>(null);

  const performValidation = useCallback(async (selectorToValidate: string, crossPage = false) => {
    if (!selectorToValidate.trim() || !projectId) return;

    setIsValidating(true);
    try {
      let result: SelectorValidationResult;
      
      if (crossPage) {
        // Use cross-page validation endpoint
        result = await projectsAPI.validateSelectorAcrossProject(projectId, selectorToValidate);
      } else {
        // Use single-page validation endpoint  
        result = await projectsAPI.validateSelector(projectId, selectorToValidate);
      }
      
      setValidationResult(result);
      onValidationComplete?.(result);
    } catch (error) {
      console.error('Validation failed:', error);
      setValidationResult({
        selector: selectorToValidate,
        isValid: false,
        elementCount: 0,
        qualityScore: 0,
        suggestions: ['Validation failed - please check your connection'],
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsValidating(false);
    }
  }, [projectId, onValidationComplete]);

  // Handle selector input changes with debouncing
  const handleSelectorChange = useCallback((newSelector: string) => {
    setSelector(newSelector);
    
    // Clear existing timeout
    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }
    
    // Set new timeout for validation
    if (newSelector.trim()) {
      const timeout = setTimeout(() => {
        performValidation(newSelector, validationMode === 'cross-page');
      }, 800); // 800ms debounce
      
      setValidationTimeout(timeout);
    } else {
      setValidationResult(null);
    }
  }, [validationTimeout, performValidation, validationMode]);

  // Handle validation mode change
  const handleModeChange = useCallback((mode: 'single' | 'cross-page') => {
    setValidationMode(mode);
    if (selector.trim()) {
      performValidation(selector, mode === 'cross-page');
    }
  }, [selector, performValidation]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeout) {
        clearTimeout(validationTimeout);
      }
    };
  }, [validationTimeout]);

  return (
    <div className={`selector-validation-panel bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Selector Validation</h3>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          {showAdvanced ? 'Simple' : 'Advanced'}
        </button>
      </div>

      {/* Validation Mode Toggle */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-sm font-medium text-gray-700">Validation Mode:</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleModeChange('single')}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              validationMode === 'single'
                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
            }`}
          >
            📄 Single Page
          </button>
          <button
            onClick={() => handleModeChange('cross-page')}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              validationMode === 'cross-page'
                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
            }`}
          >
            🌐 Cross-Page
          </button>
        </div>
      </div>

      {/* Selector Input */}
      <div className="mb-4">
        <label htmlFor="selector-input" className="block text-sm font-medium text-gray-700 mb-2">
          CSS Selector
        </label>
        <div className="relative">
          <input
            id="selector-input"
            type="text"
            value={selector}
            onChange={(e) => handleSelectorChange(e.target.value)}
            placeholder="Enter CSS selector (e.g., .button, #submit, [data-testid='login'])"
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {isValidating && (
            <div className="absolute right-3 top-2.5">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
      </div>

      {/* Validation Results */}
      {validationResult && (
        <ValidationResultsSection 
          result={validationResult}
          showAdvanced={showAdvanced}
          onSelectorSelect={onSelectorSelect}
        />
      )}

      {/* Quick Actions */}
      <QuickActionsSection 
        onSelectorSuggestion={(suggestedSelector) => handleSelectorChange(suggestedSelector)}
      />
    </div>
  );
}

// Validation results display section
function ValidationResultsSection({
  result,
  showAdvanced,
  onSelectorSelect
}: {
  result: SelectorValidationResult;
  showAdvanced: boolean;
  onSelectorSelect?: (selector: string) => void;
}) {
  const getStatusIcon = () => {
    if (result.error) return '❌';
    if (!result.isValid) return '⚠️';
    if (result.isUnique) return '✅';
    return '🔍';
  };

  const getStatusColor = () => {
    if (result.error) return 'text-red-700 bg-red-50 border-red-200';
    if (!result.isValid) return 'text-orange-700 bg-orange-50 border-orange-200';
    if (result.isUnique) return 'text-green-700 bg-green-50 border-green-200';
    return 'text-blue-700 bg-blue-50 border-blue-200';
  };

  return (
    <div className="validation-results space-y-4">
      {/* Status Summary */}
      <div className={`p-3 rounded-lg border ${getStatusColor()}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getStatusIcon()}</span>
            <div>
              <div className="font-medium">
                {result.error ? 'Validation Error' :
                 !result.isValid ? 'Selector Not Found' :
                 result.isUnique ? 'Unique Selector' : 
                 `${result.elementCount} Elements Found`}
              </div>
              {result.isValid && !result.error && (
                <div className="text-sm opacity-75">
                  Quality Score: {Math.round(result.qualityScore * 100)}%
                </div>
              )}
            </div>
          </div>
          
          {result.qualityBreakdown && (
            <div className="text-right">
              <QualityIndicator 
                element={{
                  id: 'temp',
                  projectId: '',
                  selector: result.selector,
                  elementType: 'button',
                  description: '',
                  confidence: 0,
                  attributes: {},
                  createdAt: '',
                  updatedAt: '',
                  overallQuality: result.qualityScore,
                  qualityMetrics: result.qualityBreakdown,
                  isValidated: true
                } as ProjectElement}
                mode="badge"
              />
            </div>
          )}
        </div>
      </div>

      {/* Advanced Details */}
      {showAdvanced && result.qualityBreakdown && (
        <AdvancedValidationDetails result={result} />
      )}

      {/* Cross-page Results */}
      {result.crossPageValidation && (
        <CrossPageValidationResults validation={result.crossPageValidation} />
      )}

      {/* Suggestions */}
      {result.suggestions && result.suggestions.length > 0 && (
        <SuggestionsSection 
          suggestions={result.suggestions}
          alternativeSelectors={result.alternativeSelectors}
          onSelectorSelect={onSelectorSelect}
        />
      )}
    </div>
  );
}

// Advanced validation details
function AdvancedValidationDetails({ result }: { result: SelectorValidationResult }) {
  if (!result.qualityBreakdown) return null;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded p-3">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Quality Breakdown</h4>
      <div className="grid grid-cols-2 gap-3">
        <QualityMetricItem 
          label="Uniqueness" 
          score={result.qualityBreakdown.uniqueness} 
          weight="40%"
        />
        <QualityMetricItem 
          label="Stability" 
          score={result.qualityBreakdown.stability} 
          weight="30%"
        />
        <QualityMetricItem 
          label="Specificity" 
          score={result.qualityBreakdown.specificity} 
          weight="20%"
        />
        <QualityMetricItem 
          label="Accessibility" 
          score={result.qualityBreakdown.accessibility} 
          weight="10%"
        />
      </div>
    </div>
  );
}

// Quality metric display item
function QualityMetricItem({ label, score, weight }: { label: string; score: number; weight: string }) {
  const percentage = Math.round(score * 100);
  const color = score >= 0.8 ? 'text-green-600' : 
                score >= 0.6 ? 'text-yellow-600' :
                score >= 0.4 ? 'text-orange-600' : 'text-red-600';

  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${color}`}>{percentage}%</div>
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-xs text-gray-500">({weight})</div>
    </div>
  );
}

// Cross-page validation results
function CrossPageValidationResults({ validation }: { validation: any }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded p-3">
      <h4 className="text-sm font-medium text-blue-800 mb-2">Cross-Page Analysis</h4>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-blue-600">Pages Checked:</span>
          <span className="ml-2 font-medium">{validation.totalUrls}</span>
        </div>
        <div>
          <span className="text-blue-600">Found On:</span>
          <span className="ml-2 font-medium">{validation.validUrls}</span>
        </div>
        <div>
          <span className="text-blue-600">Unique Everywhere:</span>
          <span className="ml-2 font-medium">{validation.uniqueOnAllPages ? '✅ Yes' : '❌ No'}</span>
        </div>
        <div>
          <span className="text-blue-600">Avg. Matches:</span>
          <span className="ml-2 font-medium">{validation.averageMatchCount.toFixed(1)}</span>
        </div>
      </div>
      
      {validation.inconsistentPages && validation.inconsistentPages.length > 0 && (
        <div className="mt-2">
          <span className="text-sm text-blue-600">Inconsistent on:</span>
          <div className="text-xs text-blue-700 mt-1">
            {validation.inconsistentPages.slice(0, 3).map((page: string) => (
              <div key={page} className="truncate">{page}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Suggestions section
function SuggestionsSection({
  suggestions,
  alternativeSelectors,
  onSelectorSelect
}: {
  suggestions: string[];
  alternativeSelectors?: string[];
  onSelectorSelect?: (selector: string) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Textual suggestions */}
      {suggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>
          <div className="space-y-1">
            {suggestions.slice(0, 4).map((suggestion, index) => (
              <div key={index} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-blue-500 mt-0.5">💡</span>
                <span>{suggestion}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alternative selectors */}
      {alternativeSelectors && alternativeSelectors.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Alternative Selectors</h4>
          <div className="space-y-2">
            {alternativeSelectors.slice(0, 3).map((altSelector, index) => (
              <button
                key={index}
                onClick={() => onSelectorSelect?.(altSelector)}
                className="block w-full text-left px-3 py-2 bg-blue-50 border border-blue-200 rounded font-mono text-sm text-blue-800 hover:bg-blue-100 transition-colors"
              >
                {altSelector}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Quick actions section
function QuickActionsSection({ 
  onSelectorSuggestion 
}: { 
  onSelectorSuggestion: (selector: string) => void;
}) {
  const commonSelectors = [
    { label: 'Submit Button', selector: 'button[type="submit"]' },
    { label: 'Login Button', selector: '[data-testid="login-button"]' },
    { label: 'Username Input', selector: 'input[name="username"]' },
    { label: 'Password Input', selector: 'input[type="password"]' },
    { label: 'Form Element', selector: 'form' },
    { label: 'Navigation Menu', selector: 'nav' },
  ];

  return (
    <div className="mt-6 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Examples</h4>
      <div className="grid grid-cols-2 gap-2">
        {commonSelectors.map((item, index) => (
          <button
            key={index}
            onClick={() => onSelectorSuggestion(item.selector)}
            className="text-left px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
          >
            <div className="font-medium text-gray-700">{item.label}</div>
            <div className="font-mono text-gray-500">{item.selector}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
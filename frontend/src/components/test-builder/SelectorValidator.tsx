import { useState, useEffect } from 'react';
import { validateSelector } from '../../lib/api';
import { SelectorValidationResult } from '../../types/element.types';

interface SelectorValidatorProps {
  projectId: string;
  selector: string;
  onValidationResult?: (result: SelectorValidationResult) => void;
  isEnabled?: boolean;
}

export function SelectorValidator({ 
  projectId, 
  selector, 
  onValidationResult,
  isEnabled = true 
}: SelectorValidatorProps) {
  const [validationResult, setValidationResult] = useState<SelectorValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!isEnabled || !projectId || selector.length <= 2) {
      setValidationResult(null);
      return;
    }

    const validateWithDelay = setTimeout(() => {
      performValidation();
    }, 800); // Debounce validation calls

    return () => clearTimeout(validateWithDelay);
  }, [selector, projectId, isEnabled]);

  const performValidation = async () => {
    if (!projectId || !selector) return;

    setIsValidating(true);
    try {
      const result = await validateSelector(projectId, selector);
      setValidationResult(result);
      onValidationResult?.(result);
    } catch (error) {
      const errorResult: SelectorValidationResult = {
        selector,
        isValid: false,
        elementCount: 0,
        qualityScore: 0,
        suggestions: ['Validation failed - check network connection'],
        error: 'Network error'
      };
      setValidationResult(errorResult);
      onValidationResult?.(errorResult);
    } finally {
      setIsValidating(false);
    }
  };

  if (!isEnabled || !selector || selector.length <= 2) {
    return null;
  }

  return (
    <div className="mt-2 text-sm">
      {isValidating ? (
        <div className="flex items-center text-gray-500 p-2 bg-gray-50 rounded">
          <svg className="animate-spin -ml-1 mr-2 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Validating selector...
        </div>
      ) : validationResult ? (
        <div className={`p-3 rounded-md border ${
          validationResult.isValid 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className={`flex items-center font-medium ${
              validationResult.isValid ? 'text-green-800' : 'text-red-800'
            }`}>
              {validationResult.isValid ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {validationResult.elementCount} element{validationResult.elementCount !== 1 ? 's' : ''} found
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {validationResult.error || 'Selector not found'}
                </>
              )}
            </div>
            
            {validationResult.isValid && (
              <div className="flex items-center">
                <div className="w-20 h-2 bg-gray-200 rounded-full mr-2 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      validationResult.qualityScore > 0.7 ? 'bg-green-500' :
                      validationResult.qualityScore > 0.4 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${validationResult.qualityScore * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600 font-medium">
                  {Math.round(validationResult.qualityScore * 100)}% quality
                </span>
              </div>
            )}
          </div>
          
          {validationResult.suggestions && validationResult.suggestions.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-medium text-gray-700 mb-1">Suggestions:</div>
              <div className="space-y-1">
                {validationResult.suggestions.map((suggestion, index) => (
                  <div key={index} className="text-xs text-gray-600 flex items-start">
                    <span className="text-gray-400 mr-1">•</span>
                    <span>{suggestion}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quality explanation */}
          {validationResult.isValid && (
            <div className="mt-2 text-xs text-gray-500">
              {validationResult.qualityScore > 0.7 ? (
                <span className="text-green-600">✓ High quality selector - stable and reliable</span>
              ) : validationResult.qualityScore > 0.4 ? (
                <span className="text-yellow-600">⚠ Medium quality - may need improvement</span>
              ) : (
                <span className="text-red-600">⚠ Low quality - consider using more stable attributes</span>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
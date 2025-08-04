import { useState } from 'react';
import { QualityMetrics, ProjectElement } from '../../types/element.types';

interface QualityIndicatorProps {
  element: ProjectElement;
  mode?: 'badge' | 'detailed' | 'dashboard';
  showBreakdown?: boolean;
  onImprove?: (element: ProjectElement) => void;
  className?: string;
}

export function QualityIndicator({
  element,
  mode = 'badge',
  showBreakdown = false,
  onImprove,
  className = ''
}: QualityIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const overallQuality = element.overallQuality || 0;
  const qualityMetrics = element.qualityMetrics;
  const isValidated = element.isValidated || false;

  switch (mode) {
    case 'badge':
      return (
        <QualityBadge 
          quality={overallQuality}
          isValidated={isValidated}
          className={className}
          onClick={() => setShowDetails(!showDetails)}
        />
      );

    case 'detailed':
      return (
        <DetailedQualityView
          element={element}
          qualityMetrics={qualityMetrics}
          showBreakdown={showBreakdown}
          onImprove={onImprove}
          className={className}
        />
      );

    case 'dashboard':
      return (
        <DashboardQualityView
          element={element}
          qualityMetrics={qualityMetrics}
          className={className}
        />
      );

    default:
      return null;
  }
}

// Simple badge component
function QualityBadge({ 
  quality, 
  isValidated, 
  className, 
  onClick 
}: { 
  quality: number; 
  isValidated: boolean; 
  className?: string;
  onClick?: () => void;
}) {
  const { color, icon } = getQualityStyle(quality);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={onClick}
        className={`px-2 py-1 text-xs rounded border transition-all hover:shadow-sm ${color}`}
        title={`Quality Score: ${Math.round(quality * 100)}% - Click for details`}
      >
        {icon} {Math.round(quality * 100)}%
      </button>
      
      {!isValidated && (
        <span 
          className="px-1 py-0.5 text-xs bg-gray-100 text-gray-600 rounded border border-gray-200" 
          title="Element not validated with Phase 2 quality metrics"
        >
          ❓
        </span>
      )}
    </div>
  );
}

// Detailed quality breakdown view
function DetailedQualityView({
  element,
  qualityMetrics,
  showBreakdown,
  onImprove,
  className
}: {
  element: ProjectElement;
  qualityMetrics?: QualityMetrics;
  showBreakdown: boolean;
  onImprove?: (element: ProjectElement) => void;
  className?: string;
}) {
  const overallQuality = element.overallQuality || 0;

  return (
    <div className={`quality-detailed-view bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      {/* Header with overall score */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <QualityBadge quality={overallQuality} isValidated={element.isValidated || false} />
          <span className="text-sm font-medium text-gray-700">Quality Assessment</span>
        </div>
        
        {onImprove && overallQuality < 0.8 && (
          <button
            onClick={() => onImprove(element)}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-800 border border-blue-200 rounded hover:bg-blue-200 transition-colors"
          >
            🔧 Improve
          </button>
        )}
      </div>

      {/* Quality breakdown */}
      {qualityMetrics && showBreakdown && (
        <div className="space-y-3">
          <QualityMetricBar
            label="Uniqueness"
            score={qualityMetrics.uniqueness}
            description="How well this selector targets exactly one element"
            weight="40%"
          />
          <QualityMetricBar
            label="Stability"
            score={qualityMetrics.stability}
            description="How resistant this selector is to page changes"
            weight="30%"
          />
          <QualityMetricBar
            label="Specificity"
            score={qualityMetrics.specificity}
            description="How appropriately specific this selector is"
            weight="20%"
          />
          <QualityMetricBar
            label="Accessibility"
            score={qualityMetrics.accessibility}
            description="How well this selector uses semantic attributes"
            weight="10%"
          />
        </div>
      )}

      {/* Validation status and errors */}
      <ValidationStatusSection element={element} />

      {/* Suggestions and improvements */}
      {element.validationErrors && element.validationErrors.length > 0 && (
        <SuggestionsSection 
          validationErrors={element.validationErrors}
          fallbackSelectors={element.fallbackSelectors}
        />
      )}
    </div>
  );
}

// Dashboard overview for project-wide quality
function DashboardQualityView({
  element,
  qualityMetrics,
  className
}: {
  element: ProjectElement;
  qualityMetrics?: QualityMetrics;
  className?: string;
}) {
  const overallQuality = element.overallQuality || 0;
  const { color, icon } = getQualityStyle(overallQuality);

  return (
    <div className={`quality-dashboard-item flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow ${className}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${color}`}>
          {icon}
        </div>
        
        <div>
          <div className="font-medium text-sm text-gray-900">
            {element.description}
          </div>
          <div className="text-xs text-gray-500 font-mono">
            {element.selector.length > 40 ? 
              element.selector.substring(0, 40) + '...' : 
              element.selector
            }
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <div className={`text-sm font-medium ${color.includes('green') ? 'text-green-700' : 
                          color.includes('yellow') ? 'text-yellow-700' :
                          color.includes('orange') ? 'text-orange-700' : 'text-red-700'}`}>
          {Math.round(overallQuality * 100)}%
        </div>
        {qualityMetrics && (
          <div className="text-xs text-gray-500">
            U:{Math.round(qualityMetrics.uniqueness * 100)} 
            S:{Math.round(qualityMetrics.stability * 100)}
          </div>
        )}
      </div>
    </div>
  );
}

// Individual quality metric progress bar
function QualityMetricBar({
  label,
  score,
  description,
  weight
}: {
  label: string;
  score: number;
  description: string;
  weight: string;
}) {
  const percentage = Math.round(score * 100);
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">{label}</span>
          <span className="text-xs text-gray-500">({weight})</span>
        </div>
        <span className={`font-medium ${
          score >= 0.8 ? 'text-green-700' : 
          score >= 0.6 ? 'text-yellow-700' :
          score >= 0.4 ? 'text-orange-700' : 'text-red-700'
        }`}>
          {percentage}%
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            score >= 0.8 ? 'bg-green-500' : 
            score >= 0.6 ? 'bg-yellow-500' :
            score >= 0.4 ? 'bg-orange-500' : 'bg-red-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <p className="text-xs text-gray-600">{description}</p>
    </div>
  );
}

// Validation status section
function ValidationStatusSection({ element }: { element: ProjectElement }) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Validation Status</span>
        <div className="flex items-center gap-2">
          {element.isValidated ? (
            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-800 rounded border border-green-200">
              ✅ Validated
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded border border-gray-200">
              ⏳ Pending
            </span>
          )}
          
          {element.lastValidated && (
            <span className="text-xs text-gray-500">
              {new Date(element.lastValidated).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Suggestions and improvements section
function SuggestionsSection({
  validationErrors,
  fallbackSelectors
}: {
  validationErrors: string[];
  fallbackSelectors?: string[];
}) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>
      
      {validationErrors.length > 0 && (
        <div className="space-y-1 mb-3">
          {validationErrors.slice(0, 3).map((error, index) => (
            <div key={index} className="flex items-start gap-2 text-xs">
              <span className="text-orange-500 mt-0.5">⚠️</span>
              <span className="text-gray-700">{error}</span>
            </div>
          ))}
        </div>
      )}
      
      {fallbackSelectors && fallbackSelectors.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-gray-600">Alternative selectors:</span>
          {fallbackSelectors.slice(0, 2).map((selector, index) => (
            <div key={index} className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border">
              {selector}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper function to get quality styling
function getQualityStyle(quality: number) {
  if (quality >= 0.8) {
    return {
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: '🌟',
      label: 'Excellent'
    };
  } else if (quality >= 0.6) {
    return {
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: '✅',
      label: 'Good'
    };
  } else if (quality >= 0.4) {
    return {
      color: 'bg-orange-100 text-orange-800 border-orange-200',
      icon: '⚠️',
      label: 'Fair'
    };
  } else {
    return {
      color: 'bg-red-100 text-red-800 border-red-200',
      icon: '❌',
      label: 'Poor'
    };
  }
}
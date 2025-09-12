import { useState } from 'react';
import { projectsAPI } from '../../lib/api';
import { SmartElementCard } from './SmartElementCard';

interface SmartElementAnalyzerProps {
  url: string;
  onElementSelected: (element: any) => void;
  className?: string;
}

export function SmartElementAnalyzer({ url, onElementSelected, className = '' }: SmartElementAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [elements, setElements] = useState<any[]>([]);
  const [categories, setCategories] = useState({ interactive: 0, verification: 0, containers: 0 });
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const analyzePageElements = async () => {
    if (!url) {
      setError('Please enter a valid URL first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      console.log('🎯 Starting smart element analysis for:', url);
      
      // Use the new smart element analysis API
      const result = await projectsAPI.analyzeElementsSmart(url);
      
      if (result.success) {
        const { elements: foundElements, categories: foundCategories } = result.data;
        
        setElements(foundElements);
        setCategories(foundCategories);
        setHasAnalyzed(true);
        
        console.log(`✅ Smart analysis complete: ${foundElements.length} elements found`);
        console.log('📊 Categories:', foundCategories);
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
      
    } catch (err) {
      console.error('❌ Smart element analysis failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      setError(`Smart analysis failed: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearAnalysis = () => {
    setElements([]);
    setCategories({ interactive: 0, verification: 0, containers: 0 });
    setHasAnalyzed(false);
    setError(null);
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* 🎯 HEADER */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Smart Element Analysis</h3>
            <p className="text-sm text-gray-600 mt-1">
              Automatically find interactive elements and verification text
            </p>
          </div>
          
          <div className="flex gap-2">
            {hasAnalyzed && (
              <button
                onClick={clearAnalysis}
                disabled={isAnalyzing}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            )}
            
            <button
              onClick={analyzePageElements}
              disabled={isAnalyzing || !url}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Analyze Page
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* 📊 CATEGORIES SUMMARY */}
        {hasAnalyzed && (
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">
                Interactive: <span className="font-medium">{categories.interactive}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">
                Verification: <span className="font-medium">{categories.verification}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <span className="text-sm text-gray-600">
                Total: <span className="font-medium">{elements.length}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ❌ ERROR STATE */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 📋 ELEMENTS LIST */}
      {elements.length > 0 && (
        <div className="max-h-96 overflow-y-auto">
          <div className="p-4 space-y-3">
            {elements.map((element) => (
              <SmartElementCard
                key={element.id}
                element={element}
                onSelect={onElementSelected}
                showRemoveButton={false}
                className="hover:shadow-md"
              />
            ))}
          </div>
        </div>
      )}

      {/* 📝 EMPTY STATE */}
      {hasAnalyzed && elements.length === 0 && !error && (
        <div className="p-8 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0120 12a8 8 0 00-16 0 8.01 8.01 0 002 5.291M15 21H9a2 2 0 01-2-2v-1.034" />
          </svg>
          <p className="text-sm">No useful elements found on this page.</p>
          <p className="text-xs text-gray-400 mt-1">The page might be loading or have no interactive elements.</p>
        </div>
      )}
      
      {/* 📝 INITIAL STATE */}
      {!hasAnalyzed && !isAnalyzing && (
        <div className="p-8 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm">Ready to analyze page elements</p>
          <p className="text-xs text-gray-400 mt-1">Click "Analyze Page" to find interactive elements automatically</p>
        </div>
      )}
    </div>
  );
}
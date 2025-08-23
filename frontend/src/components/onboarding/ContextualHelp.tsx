import { useState, useEffect } from 'react'
import { useAnalytics } from '../../lib/analytics'

interface HelpTip {
  id: string
  title: string
  content: string
  position: 'top' | 'bottom' | 'left' | 'right'
  priority: 'high' | 'medium' | 'low'
}

interface ContextualHelpProps {
  page: 'upload' | 'analysis' | 'selection' | 'testing'
  trigger?: string
  isVisible?: boolean
}

const helpTips: Record<string, HelpTip[]> = {
  upload: [
    {
      id: 'revolutionary_feature',
      title: '🚀 Revolutionary Technology',
      content: 'You\'re using the world\'s first tool that can test your local development projects without deployment. This is a game-changer for developer productivity!',
      position: 'bottom',
      priority: 'high'
    },
    {
      id: 'supported_frameworks',
      title: '🛠️ Framework Support',
      content: 'We support React (.jsx/.tsx), Vue (.vue), and Angular (.component.ts) projects. Our AST parser extracts perfect selectors from your source code.',
      position: 'top',
      priority: 'medium'
    },
    {
      id: 'folder_structure',
      title: '📁 What to Upload',
      content: 'Upload your entire project folder - supports React, Vue, Angular, PHP, Python, Java & 30+ languages. We\'ll automatically analyze your code structure and filter out unnecessary files like node_modules.',
      position: 'right',
      priority: 'medium'
    }
  ],
  analysis: [
    {
      id: 'ast_parsing',
      title: '🧠 Smart Analysis',
      content: 'Our AI is parsing your component structure, extracting interactive elements like buttons, inputs, forms, and links with their exact selectors.',
      position: 'left',
      priority: 'high'
    },
    {
      id: 'element_extraction',
      title: '🎯 Perfect Selectors',
      content: 'Unlike other tools that guess selectors, we read your source code to generate the most reliable, maintainable selectors possible.',
      position: 'bottom',
      priority: 'high'
    }
  ],
  selection: [
    {
      id: 'element_quality',
      title: '✨ Quality Indicators',
      content: 'Elements with green indicators have the highest confidence scores. These come from clear, unambiguous source code patterns.',
      position: 'top',
      priority: 'high'
    },
    {
      id: 'selective_testing',
      title: '🎯 Choose Wisely',
      content: 'You don\'t need to test every element. Focus on critical user interactions like login buttons, form submissions, and navigation.',
      position: 'right',
      priority: 'medium'
    },
    {
      id: 'batch_operations',
      title: '⚡ Bulk Actions',
      content: 'Use the checkboxes to select multiple elements at once. You can filter by component, element type, or confidence level.',
      position: 'bottom',
      priority: 'medium'
    }
  ],
  testing: [
    {
      id: 'visual_builder',
      title: '🎨 Visual Test Builder',
      content: 'Drag and drop test steps to create comprehensive test scenarios. No coding required - just point, click, and verify.',
      position: 'top',
      priority: 'high'
    },
    {
      id: 'robot_framework',
      title: '🤖 Professional Output',
      content: 'Your tests generate industry-standard Robot Framework files that integrate seamlessly with CI/CD pipelines and professional testing workflows.',
      position: 'right',
      priority: 'high'
    }
  ]
}

export function ContextualHelp({ page, trigger, isVisible = true }: ContextualHelpProps) {
  const { trackFeatureUsage } = useAnalytics()
  const [currentTipIndex, setCurrentTipIndex] = useState(0)
  const [isDismissed, setIsDismissed] = useState(false)
  const [expandedTip, setExpandedTip] = useState<string | null>(null)

  const tips = helpTips[page] || []
  const currentTip = tips[currentTipIndex]

  useEffect(() => {
    // Reset when page changes
    setCurrentTipIndex(0)
    setIsDismissed(false)
    setExpandedTip(null)
  }, [page])

  useEffect(() => {
    if (currentTip && isVisible && !isDismissed) {
      trackFeatureUsage('contextual_help_shown', {
        page,
        tip_id: currentTip.id,
        trigger
      })
    }
  }, [currentTip, page, trigger, isVisible, isDismissed, trackFeatureUsage])

  const handleNext = () => {
    if (currentTipIndex < tips.length - 1) {
      setCurrentTipIndex(prev => prev + 1)
      trackFeatureUsage('contextual_help_next', {
        from_tip: currentTip?.id,
        to_tip: tips[currentTipIndex + 1]?.id
      })
    } else {
      setIsDismissed(true)
    }
  }

  const handlePrevious = () => {
    if (currentTipIndex > 0) {
      setCurrentTipIndex(prev => prev - 1)
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    trackFeatureUsage('contextual_help_dismissed', {
      page,
      tip_id: currentTip?.id,
      tips_viewed: currentTipIndex + 1,
      total_tips: tips.length
    })
  }

  const toggleExpanded = (tipId: string) => {
    if (expandedTip === tipId) {
      setExpandedTip(null)
    } else {
      setExpandedTip(tipId)
      trackFeatureUsage('contextual_help_expanded', { tip_id: tipId })
    }
  }

  if (!isVisible || isDismissed || !currentTip || tips.length === 0) return null

  return (
    <div className="fixed bottom-4 left-4 max-w-sm bg-white rounded-lg shadow-lg border border-gray-200 z-40 animate-slide-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white p-3 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="text-lg">💡</div>
            <div>
              <h3 className="font-medium text-sm">Quick Tip</h3>
              <p className="text-xs opacity-75">
                {currentTipIndex + 1} of {tips.length}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white hover:text-gray-200 text-lg font-bold"
            aria-label="Dismiss tip"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div 
          className={`transition-all duration-300 ${
            expandedTip === currentTip.id ? 'max-h-40' : 'max-h-20'
          } overflow-hidden`}
        >
          <h4 className="font-medium text-gray-900 text-sm mb-2">
            {currentTip.title}
          </h4>
          <p className="text-xs text-gray-600 leading-relaxed">
            {currentTip.content}
          </p>
        </div>

        {/* Expand/Collapse */}
        {currentTip.content.length > 100 && (
          <button
            onClick={() => toggleExpanded(currentTip.id)}
            className="text-xs text-blue-600 hover:text-blue-800 mt-2 flex items-center space-x-1"
          >
            <span>{expandedTip === currentTip.id ? 'Show less' : 'Read more'}</span>
            <svg 
              className={`w-3 h-3 transform transition-transform ${
                expandedTip === currentTip.id ? 'rotate-180' : ''
              }`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Priority Indicator */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
          <div className="flex items-center space-x-1">
            {currentTip.priority === 'high' && (
              <div className="flex items-center space-x-1 text-red-600">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-xs">Important</span>
              </div>
            )}
            {currentTip.priority === 'medium' && (
              <div className="flex items-center space-x-1 text-yellow-600">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-xs">Helpful</span>
              </div>
            )}
            {currentTip.priority === 'low' && (
              <div className="flex items-center space-x-1 text-gray-500">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-xs">Optional</span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevious}
              disabled={currentTipIndex === 0}
              className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <div className="text-xs text-gray-400">|</div>
            <button
              onClick={handleNext}
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
            >
              {currentTipIndex === tips.length - 1 ? 'Got it!' : 'Next →'}
            </button>
          </div>
        </div>
      </div>

      {/* Progress Dots */}
      <div className="px-4 pb-3">
        <div className="flex justify-center space-x-1">
          {tips.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                index === currentTipIndex
                  ? 'bg-blue-600'
                  : index < currentTipIndex
                  ? 'bg-green-500'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Hook to manage contextual help
export function useContextualHelp() {
  const [currentPage, setCurrentPage] = useState<'upload' | 'analysis' | 'selection' | 'testing'>('upload')
  const [isHelpEnabled, setIsHelpEnabled] = useState(() => {
    return localStorage.getItem('nomation_contextual_help_enabled') !== 'false'
  })

  const enableHelp = () => {
    setIsHelpEnabled(true)
    localStorage.setItem('nomation_contextual_help_enabled', 'true')
  }

  const disableHelp = () => {
    setIsHelpEnabled(false)
    localStorage.setItem('nomation_contextual_help_enabled', 'false')
  }

  return {
    currentPage,
    setCurrentPage,
    isHelpEnabled,
    enableHelp,
    disableHelp
  }
}
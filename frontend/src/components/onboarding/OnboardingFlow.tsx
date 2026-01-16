import { useState, useEffect } from 'react'
import { useAnalytics } from '../../lib/analytics'

interface OnboardingStep {
  id: string
  title: string
  description: string
  action?: string
  completed: boolean
}

interface OnboardingFlowProps {
  currentStep: 'upload' | 'analysis' | 'selection' | 'testing' | 'completed'
  isVisible: boolean
  onDismiss: () => void
  onStepComplete?: (stepId: string) => void
}

export function OnboardingFlow({ currentStep, isVisible, onDismiss }: OnboardingFlowProps) {
  const { trackFeatureUsage } = useAnalytics()
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('nomation_onboarding_minimized') === 'true'
  })

  const steps: OnboardingStep[] = [
    {
      id: 'upload',
      title: '📁 Upload Your Project',
      description: 'Drag and drop your project folder - supports React, Vue, Angular, PHP, Python, Java & 30+ frameworks',
      action: 'Click or drag your project folder to the upload area below',
      completed: ['analysis', 'selection', 'testing', 'completed'].includes(currentStep)
    },
    {
      id: 'analysis',
      title: '🔍 Automatic Analysis',
      description: 'Our AI analyzes your source code to extract testable UI elements',
      action: 'Watch as we scan your components and generate perfect selectors',
      completed: ['selection', 'testing', 'completed'].includes(currentStep)
    },
    {
      id: 'selection',
      title: '🎯 Select Elements',
      description: 'Choose which UI elements you want to include in your test library',
      action: 'Review the extracted elements and select the ones you want to test',
      completed: ['testing', 'completed'].includes(currentStep)
    },
    {
      id: 'testing',
      title: '🚀 Create Tests',
      description: 'Build visual tests using our drag-and-drop test builder',
      action: 'Head to the test builder to create your first automated test',
      completed: currentStep === 'completed'
    }
  ]

  const currentStepIndex = steps.findIndex(step => step.id === currentStep)
  const progressPercent = currentStepIndex >= 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0

  useEffect(() => {
    if (isVisible && currentStep) {
      trackFeatureUsage('onboarding_step_viewed', {
        step: currentStep,
        step_index: currentStepIndex
      })
    }
  }, [currentStep, isVisible, currentStepIndex, trackFeatureUsage])

  const handleStepClick = (stepId: string) => {
    if (expandedStep === stepId) {
      setExpandedStep(null)
    } else {
      setExpandedStep(stepId)
      trackFeatureUsage('onboarding_step_expanded', { step: stepId })
    }
  }

  const handleDismiss = () => {
    trackFeatureUsage('onboarding_dismissed', {
      current_step: currentStep,
      progress_percent: progressPercent
    })
    onDismiss()
  }

  const handleMinimize = () => {
    setIsMinimized(true)
    localStorage.setItem('nomation_onboarding_minimized', 'true')
    trackFeatureUsage('onboarding_minimized', {
      current_step: currentStep,
      progress_percent: progressPercent
    })
  }

  const handleMaximize = () => {
    setIsMinimized(false)
    localStorage.setItem('nomation_onboarding_minimized', 'false')
    trackFeatureUsage('onboarding_maximized', {
      current_step: currentStep,
      progress_percent: progressPercent
    })
  }

  if (!isVisible) return null

  // Minimized view
  if (isMinimized) {
    return (
      <div className="fixed top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 z-50 animate-slide-up cursor-pointer"
           onClick={handleMaximize}
           title="Click to expand Quick Start Guide">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span>🚀</span>
              <span className="font-medium text-sm">Quick Start</span>
              <div className="bg-white bg-opacity-30 rounded-full px-2 py-0.5">
                <span className="text-xs">{Math.round(progressPercent)}%</span>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleMaximize()
                }}
                className="text-white hover:text-gray-200 text-sm"
                title="Expand guide"
                aria-label="Expand onboarding guide"
              >
                ⬆️
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDismiss()
                }}
                className="text-white hover:text-gray-200 text-lg font-bold ml-1"
                aria-label="Close onboarding"
              >
                ×
              </button>
            </div>
          </div>
          
          {/* Mini progress bar */}
          <div className="mt-2">
            <div className="w-full bg-white bg-opacity-30 rounded-full h-1">
              <div 
                className="bg-white h-1 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          
          {/* Current step indicator */}
          <div className="text-xs opacity-75 mt-1">
            Step {currentStepIndex + 1}/{steps.length}: {steps[currentStepIndex]?.title.replace(/^[^\s]+\s/, '') || 'Complete'}
          </div>
        </div>
      </div>
    )
  }

  // Expanded view
  return (
    <div className="fixed top-4 right-4 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 animate-slide-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">🚀 Quick Start Guide</h3>
            <p className="text-sm opacity-90">Your first revolutionary test</p>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={handleMinimize}
              className="text-white hover:text-gray-200 text-lg"
              title="Minimize guide"
              aria-label="Minimize onboarding guide"
            >
              ⬇️
            </button>
            <button
              onClick={handleDismiss}
              className="text-white hover:text-gray-200 text-xl font-bold"
              aria-label="Close onboarding"
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs opacity-75 mb-1">
            <span>Progress</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full bg-white bg-opacity-30 rounded-full h-2">
            <div 
              className="bg-white h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep
          const isExpanded = expandedStep === step.id
          const canExpand = step.action && !step.completed

          return (
            <div
              key={step.id}
              className={`border rounded-lg transition-all duration-300 ${
                isActive
                  ? 'border-blue-500 bg-blue-50'
                  : step.completed
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
              }`}
            >
              <div
                className={`p-3 ${canExpand ? 'cursor-pointer' : ''}`}
                onClick={canExpand ? () => handleStepClick(step.id) : undefined}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step.completed
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}>
                    {step.completed ? '✓' : index + 1}
                  </div>
                  
                  <div className="flex-1">
                    <h4 className={`font-medium text-sm ${
                      isActive ? 'text-blue-700' : step.completed ? 'text-green-700' : 'text-gray-700'
                    }`}>
                      {step.title}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      {step.description}
                    </p>
                  </div>

                  {canExpand && (
                    <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Expanded Action */}
                {isExpanded && step.action && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="bg-blue-100 rounded p-2">
                      <p className="text-xs text-blue-800">
                        💡 <strong>Next:</strong> {step.action}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
        <div className="flex items-center justify-between text-xs">
          <div className="text-gray-600">
            Step {currentStepIndex + 1} of {steps.length}
          </div>
          {progressPercent === 100 ? (
            <div className="flex items-center space-x-1 text-green-600 font-medium">
              <span>🎉</span>
              <span>Complete!</span>
            </div>
          ) : (
            <div className="text-gray-600">
              {steps.length - currentStepIndex - 1} steps left
            </div>
          )}
        </div>
        
        {/* Revolutionary Feature Badge */}
        <div className="mt-2 text-center">
          <div className="inline-block bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
            🌟 World's First Local Testing Platform
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook to manage onboarding state
export function useOnboarding() {
  const [isOnboardingVisible, setIsOnboardingVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState<'upload' | 'analysis' | 'selection' | 'testing' | 'completed'>('upload')
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    return localStorage.getItem('nomation_onboarding_completed') === 'true'
  })

  // Show onboarding for first-time users
  useEffect(() => {
    if (!hasSeenOnboarding) {
      setIsOnboardingVisible(true)
    }
  }, [hasSeenOnboarding])

  const startOnboarding = () => {
    setCurrentStep('upload')
    setIsOnboardingVisible(true)
  }

  const nextStep = () => {
    const steps = ['upload', 'analysis', 'selection', 'testing', 'completed'] as const
    const currentIndex = steps.indexOf(currentStep)
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1])
    }
  }

  const completeOnboarding = () => {
    setCurrentStep('completed')
    setHasSeenOnboarding(true)
    localStorage.setItem('nomation_onboarding_completed', 'true')
    // Auto-hide after completion
    setTimeout(() => {
      setIsOnboardingVisible(false)
    }, 3000)
  }

  const dismissOnboarding = () => {
    setIsOnboardingVisible(false)
    setHasSeenOnboarding(true)
    localStorage.setItem('nomation_onboarding_completed', 'true')
  }

  const showOnboarding = () => {
    setIsOnboardingVisible(true)
  }

  const hideOnboarding = () => {
    setIsOnboardingVisible(false)
  }

  return {
    isOnboardingVisible,
    currentStep,
    startOnboarding,
    nextStep,
    completeOnboarding,
    dismissOnboarding,
    showOnboarding,
    hideOnboarding,
    setCurrentStep
  }
}
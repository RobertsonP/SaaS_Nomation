import { useState, useEffect, useCallback } from 'react'
import { projectsAPI, browserAPI } from '../../lib/api'
import { BrowserPreview } from '../element-picker/BrowserPreview'
import { LiveSessionBrowser } from '../execution/LiveSessionBrowser'
import { 
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { ProjectElement } from '../../types/element.types'
import { SortableTestStep } from './SortableTestStep'
import { DragOverlay } from './DragOverlay'
import { LiveExecutionModal } from '../execution/LiveExecutionModal'

interface TestStep {
  id: string
  type: 'click' | 'type' | 'wait' | 'assert' | 'hover' | 'scroll' | 'select' | 'clear' | 'doubleclick' | 'rightclick' | 'press' | 'upload' | 'check' | 'uncheck'
  selector: string
  value?: string
  description: string
}

interface TestBuilderPanelProps {
  selectedElement?: ProjectElement
  onClearSelection?: () => void
  className?: string
  onSave?: (steps: TestStep[]) => void
  onCancel?: () => void
  initialSteps?: TestStep[]
  testId?: string // For localStorage key identification
  projectId?: string // For element hunting
  onHuntNewElements?: (newElements: ProjectElement[]) => void // Callback for new elements
  startingUrl?: string // 🎯 CRITICAL FIX: Use test's starting URL instead of project's first URL
  // NEW: Auto-add to test steps integration
  _onAutoAddToTestSteps?: (element: ProjectElement, action?: string) => void
}

export function TestBuilderPanel({ 
  selectedElement, 
  onClearSelection,
  className = '',
  onSave,
  onCancel,
  initialSteps = [],
  testId,
  projectId,
  onHuntNewElements,
  startingUrl, // 🎯 CRITICAL FIX: Accept test's starting URL
  _onAutoAddToTestSteps
}: TestBuilderPanelProps) {
  // Initialize steps with localStorage persistence
  const [steps, setSteps] = useState<TestStep[]>(() => {
    if (testId) {
      const savedSteps = localStorage.getItem(`test-steps-${testId}`);
      if (savedSteps) {
        try {
          const parsedSteps = JSON.parse(savedSteps);
          // Always return saved steps if they exist (user has unsaved changes)
          return parsedSteps;
        } catch (e) {
          console.warn('Failed to parse saved steps:', e);
          localStorage.removeItem(`test-steps-${testId}`); // Clean up corrupted data
        }
      }
    }
    return initialSteps;
  })
  
  const [showAddStep, setShowAddStep] = useState(false)
  const [editingStep, setEditingStep] = useState<TestStep | null>(null)
  const [newStep, setNewStep] = useState<Partial<TestStep>>({
    type: 'click',
    selector: '',
    value: '',
    description: ''
  })
  const [activeStep, setActiveStep] = useState<TestStep | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isHuntingElements, setIsHuntingElements] = useState(false)
  const [executingStepId, setExecutingStepId] = useState<string | null>(null)
  const [showExecutionModal, setShowExecutionModal] = useState(false)
  const [executionResult, setExecutionResult] = useState<any>(null)
  const [executedStep, setExecutedStep] = useState<TestStep | null>(null)
  // NEW: Sequential execution state
  const [isExecutingAllSteps, setIsExecutingAllSteps] = useState(false)
  const [currentExecutingStepIndex, setCurrentExecutingStepIndex] = useState<number>(-1)
  const [sequentialExecutionResults, setSequentialExecutionResults] = useState<Array<{step: TestStep, result: any, success: boolean}>>([])
  const [showSequentialExecutionModal, setShowSequentialExecutionModal] = useState(false)
  const [executionStartingUrl, setExecutionStartingUrl] = useState<string>('')
  const [currentExecutingStep, setCurrentExecutingStep] = useState<TestStep | null>(null)
  const [browserSessionToken, setBrowserSessionToken] = useState<string | null>(null)
  const [currentBrowserUrl, setCurrentBrowserUrl] = useState<string>('')

  // Save steps to localStorage whenever they change
  useEffect(() => {
    if (testId) {
      // Always save to localStorage, even if steps array is empty
      localStorage.setItem(`test-steps-${testId}`, JSON.stringify(steps));
      // Check if steps are different from initial (has unsaved changes)
      const hasChanges = JSON.stringify(steps) !== JSON.stringify(initialSteps);
      setHasUnsavedChanges(hasChanges);
    }
  }, [steps, testId, initialSteps]);

  // NEW: Auto-add functionality for live element picker integration
  const _handleAutoAddTestStep = useCallback((element: ProjectElement, action?: string) => {
    if (!element || !element.selector) {
      console.warn('Cannot auto-add test step: Invalid element data');
      return;
    }

    const actionType = action || getDefaultActionForElement(element.elementType);
    const stepId = generateId();

    const newTestStep: TestStep = {
      id: stepId,
      type: actionType as TestStep['type'],
      selector: element.selector,
      value: actionType === 'type' ? '' : undefined, // Leave value empty for type actions
      description: `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} on ${element.description}`
    };

    // Add step with visual highlighting
    setSteps(prevSteps => {
      // Check for duplicates based on selector and action
      const isDuplicate = prevSteps.some(step => 
        step.selector === newTestStep.selector && step.type === newTestStep.type
      );
      
      if (isDuplicate) {
        console.log('🔄 Step already exists, highlighting existing step');
        // Visual feedback for existing step
        showAutoAddNotification(element, actionType, true);
        return prevSteps;
      }

      console.log(`✅ Auto-added test step: ${newTestStep.description}`);
      // Show success notification with highlighting
      showAutoAddNotification(element, actionType, false);
      return [...prevSteps, newTestStep];
    });
  }, [steps]);

  // Helper function to get default action for element type
  const getDefaultActionForElement = (elementType: string): string => {
    switch (elementType) {
      case 'button': return 'click';
      case 'input': return 'type';
      case 'link': return 'click';
      case 'form': return 'click';
      case 'text': return 'assert';
      case 'navigation': return 'click';
      default: return 'click';
    }
  };

  // Show visual feedback when element is auto-added
  const showAutoAddNotification = (element: ProjectElement, action: string, isExisting: boolean = false) => {
    // Create temporary notification element
    const notification = document.createElement('div');
    const _bgColor = isExisting ? '#F59E0B' : '#10B981';
    const bgGradient = isExisting 
      ? 'linear-gradient(135deg, #F59E0B, #D97706)' 
      : 'linear-gradient(135deg, #10B981, #059669)';
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgGradient};
      color: white;
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 10px 25px rgba(${isExisting ? '245, 158, 11' : '16, 185, 129'}, 0.3);
      animation: slideInRight 0.3s ease-out, fadeOut 0.3s ease-out 2.7s;
      max-width: 350px;
    `;
    
    const emoji = isExisting ? '🔄' : '🎯';
    const title = isExisting ? 'Step already exists!' : 'Auto-added to test steps!';
    
    notification.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px;">
        ${emoji} ${title}
      </div>
      <div style="font-size: 12px; opacity: 0.9;">
        ${action.toUpperCase()} → ${element.description}
      </div>
    `;
    
    // Add CSS animation keyframes if not exists
    if (!document.querySelector('#auto-add-animations')) {
      const style = document.createElement('style');
      style.id = 'auto-add-animations';
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Remove notification after animation
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  };

  // Update steps when initialSteps changes (but prevent during execution)
  useEffect(() => {
    // CRITICAL: Don't update steps during execution to prevent component re-renders
    if (isExecutingAllSteps) {
      return;
    }
    
    if (initialSteps.length > 0 && testId) {
      // Check if localStorage has data
      const savedSteps = localStorage.getItem(`test-steps-${testId}`);
      if (!savedSteps) {
        // No localStorage data, use initialSteps (loaded from database)
        setSteps(initialSteps);
      }
    } else if (initialSteps.length > 0 && !testId) {
      // For new tests without testId, always use initialSteps
      setSteps(initialSteps);
    }
  }, [initialSteps, testId, isExecutingAllSteps]);

  // Clear localStorage when component unmounts or test is saved
  useEffect(() => {
    return () => {
      // Cleanup function - don't clear here as user might refresh
    };
  }, []);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const stepTypes = [
    { value: 'click', label: 'Click Element', needsValue: false },
    { value: 'doubleclick', label: 'Double Click Element', needsValue: false },
    { value: 'rightclick', label: 'Right Click Element', needsValue: false },
    { value: 'hover', label: 'Hover Over Element', needsValue: false },
    { value: 'type', label: 'Type Text', needsValue: true },
    { value: 'clear', label: 'Clear Input Field', needsValue: false },
    { value: 'select', label: 'Select Option', needsValue: true },
    { value: 'check', label: 'Check Checkbox', needsValue: false },
    { value: 'uncheck', label: 'Uncheck Checkbox', needsValue: false },
    { value: 'upload', label: 'Upload File', needsValue: true },
    { value: 'scroll', label: 'Scroll', needsValue: true },
    { value: 'press', label: 'Press Key', needsValue: true },
    { value: 'wait', label: 'Wait', needsValue: true },
    { value: 'assert', label: 'Assert Text', needsValue: true }
  ]

  const generateId = () => Math.random().toString(36).substr(2, 9)


  const addStep = () => {
    if (!newStep.selector || !newStep.description) return
    
    const step: TestStep = {
      id: generateId(),
      type: newStep.type as TestStep['type'],
      selector: newStep.selector,
      value: newStep.value,
      description: newStep.description
    }
    
    if (editingStep) {
      setSteps(steps.map(s => s.id === editingStep.id ? step : s))
      setEditingStep(null)
    } else {
      setSteps([...steps, step])
    }
    
    setNewStep({
      type: 'click',
      selector: '',
      value: '',
      description: ''
    })
    setShowAddStep(false)
  }

  const removeStep = (id: string) => {
    setSteps(steps.filter(step => step.id !== id))
  }

  const editStep = (step: TestStep) => {
    setEditingStep(step)
    setNewStep({
      type: step.type,
      selector: step.selector,
      value: step.value,
      description: step.description
    })
    setShowAddStep(true)
  }

  const cancelEdit = () => {
    setEditingStep(null)
    setNewStep({
      type: 'click',
      selector: '',
      value: '',
      description: ''
    })
    setShowAddStep(false)
  }

  // DnD Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const active = event.active
    const activeStepData = steps.find(step => step.id === active.id)
    if (activeStepData) {
      setActiveStep(activeStepData)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (active.id !== over?.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over?.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
    
    setActiveStep(null)
  }

  const selectedStepType = stepTypes.find(type => type.value === newStep.type)

  // Live Execute Single Step function
  const handleLiveExecuteStep = async (step: TestStep) => {
    if (!projectId) {
      alert('Project ID is required to execute steps live.')
      return
    }

    setExecutingStepId(step.id)
    try {
      console.log(`🔴 Live executing step: ${step.description}`)

      // Use shared browser session approach (same as sequential execution)
      let sessionToken = browserSessionToken

      // If no active session, create one
      if (!sessionToken) {
        console.log(`🌐 Creating browser session for single step execution...`)
        const project = await projectsAPI.getById(projectId)
        const testStartingUrl = startingUrl || project.data.urls?.[0]?.url || 'https://example.com' // 🎯 CRITICAL FIX: Use test's starting URL
        
        const sessionResponse = await browserAPI.createSession(projectId)
        sessionToken = sessionResponse.sessionToken
        setBrowserSessionToken(sessionToken)
        
        // Navigate to starting URL
        await browserAPI.navigateSession(sessionToken!, testStartingUrl)
        setCurrentBrowserUrl(testStartingUrl)
        console.log(`✅ Browser session created and navigated to: ${testStartingUrl}`)
      }

      // Convert test step to browser action format
      let action: { type: string; selector: string; value?: string }
      
      switch (step.type) {
        case 'type':
        case 'clear':
          action = { type: 'type', selector: step.selector, value: step.value || '' }
          break
        case 'click':
        case 'doubleclick':
        case 'rightclick':
          action = { type: 'click', selector: step.selector }
          break
        case 'hover':
          action = { type: 'hover', selector: step.selector }
          break
        default:
          // For unsupported actions, fallback to click
          action = { type: 'click', selector: step.selector }
      }

      // Execute action in shared browser session
      const response = await browserAPI.executeAction(sessionToken!, action)
      console.log(`✅ Step executed:`, response)
      
      // Update frontend URL to match backend browser state
      const sessionInfo = await browserAPI.getSessionInfo(sessionToken!)
      if (sessionInfo.session?.currentUrl) {
        setCurrentBrowserUrl(sessionInfo.session.currentUrl)
      }
      
      // Show execution results in professional modal
      setExecutedStep(step);
      setExecutionResult({
        success: true,
        result: response,
        elementsFound: response.elements,
        executionContext: 'live session'
      });
      setShowExecutionModal(true);
    } catch (error: any) {
      console.error('Live step execution failed:', error)
      
      let errorMessage = 'Failed to execute step live. '
      if (error?.response?.status === 500) {
        errorMessage += 'Server error occurred during step execution.'
      } else if (error?.response?.status === 404) {
        errorMessage += 'Live execution endpoint not found.'
      } else if (error?.response?.data?.message) {
        errorMessage += error.response.data.message
      } else if (error?.message) {
        errorMessage += error.message
      } else {
        errorMessage += 'Please check that the step is valid and try again.'
      }
      
      // Show error in modal
      setExecutedStep(step);
      setExecutionResult({
        success: false,
        error: errorMessage
      });
      setShowExecutionModal(true);
    } finally {
      setExecutingStepId(null)
    }
  }

  // Hunt New Elements function
  const handleHuntNewElements = async () => {
    if (steps.length === 0 || !projectId) {
      alert('Please add some test steps first to hunt for new elements after interactions.')
      return
    }

    setIsHuntingElements(true)
    try {
      // Execute the current test steps and discover new elements
      const response = await projectsAPI.huntNewElements(projectId, {
        steps: steps,
        testId: testId || 'temp-hunt'
      })

      // Backend returns: { success: true, newElements: [...], message: "..." }
      // response is already the data from backend (axios handles response.data)
      console.log('Hunt elements response:', response);
      
      if (response && response.newElements) {
        const newElementsCount = response.newElements.length
        if (newElementsCount > 0) {
          // Notify parent component about new elements
          onHuntNewElements?.(response.newElements)
          alert(`🎉 Found ${newElementsCount} new elements! They have been added to your element library.`)
        } else {
          alert('No new elements found after executing your test steps.')
        }
      } else {
        console.warn('Unexpected response format:', response);
        alert('Hunt completed but response format was unexpected. Check console for details.')
      }
    } catch (error: any) {
      console.error('Failed to hunt new elements:', error)
      
      // Show specific error message based on error type
      let errorMessage = 'Failed to hunt new elements. '
      if (error?.response?.status === 500) {
        errorMessage += 'Server error occurred during element analysis.'
      } else if (error?.response?.status === 404) {
        errorMessage += 'Project or analysis endpoint not found.'
      } else if (error?.response?.data?.message) {
        errorMessage += error.response.data.message
      } else if (error?.message) {
        errorMessage += error.message
      } else {
        errorMessage += 'Please check that your test steps are valid and try again.'
      }
      
      alert(`❌ ${errorMessage}`)
    } finally {
      setIsHuntingElements(false)
    }
  }

  // NEW: Sequential execution of all steps (wrapped in useCallback to prevent re-renders)
  const handleExecuteAllSteps = useCallback(async () => {
    if (steps.length === 0 || !projectId) {
      alert('Please add some test steps first to execute the complete flow.')
      return
    }

    setIsExecutingAllSteps(true)
    setCurrentExecutingStepIndex(-1)
    setSequentialExecutionResults([])
    setShowSequentialExecutionModal(true)

    try {
      console.log(`🚀 Starting sequential execution of ${steps.length} steps`)
      
      // Get project data to extract starting URL (with test starting URL priority)
      const project = await projectsAPI.getById(projectId)
      console.log('🔍 DEBUG URLs array:', project.data.urls?.[0])
      const testStartingUrl = startingUrl || project.data.urls?.[0]?.url || 'https://example.com' // 🎯 CRITICAL FIX: Use test's starting URL
      console.log('🔍 DEBUG testStartingUrl type:', typeof testStartingUrl, 'value:', testStartingUrl)
      
      console.log(`📍 Starting URL: ${testStartingUrl}`)
      
      // Set URL for browser execution view
      setExecutionStartingUrl(testStartingUrl)
      setCurrentBrowserUrl(testStartingUrl)

      // Create shared browser session for live execution
      console.log(`🌐 Creating shared browser session...`)
      const sessionResponse = await browserAPI.createSession(projectId)
      const sessionToken = sessionResponse.sessionToken
      setBrowserSessionToken(sessionToken)
      console.log(`✅ Browser session created: ${sessionToken}`)

      // Navigate to starting URL in the session
      console.log(`🌍 Navigating session to: ${testStartingUrl}`)
      await browserAPI.navigateSession(sessionToken, testStartingUrl)
      console.log(`✅ Navigation completed`)

      const results: Array<{step: TestStep, result: any, success: boolean}> = []

      // Execute each step sequentially in the shared session
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        setCurrentExecutingStepIndex(i)
        setCurrentExecutingStep(step)
        
        console.log(`🎯 Executing step ${i + 1}/${steps.length}:`, step.description)

        try {
          // Convert test step to browser action format
          let action: { type: string; selector: string; value?: string }
          
          switch (step.type) {
            case 'type':
            case 'clear':
              action = { type: 'type', selector: step.selector, value: step.value || '' }
              break
            case 'click':
            case 'doubleclick':
            case 'rightclick':
              action = { type: 'click', selector: step.selector }
              break
            case 'hover':
              action = { type: 'hover', selector: step.selector }
              break
            default:
              // For unsupported actions, fallback to click
              action = { type: 'click', selector: step.selector }
          }

          // Execute action in shared browser session
          const response = await browserAPI.executeAction(sessionToken, action)
          console.log(`✅ Step ${i + 1} completed:`, response)
          
          // Update frontend URL to match backend browser state
          const sessionInfo = await browserAPI.getSessionInfo(sessionToken)
          if (sessionInfo.session?.currentUrl) {
            setCurrentBrowserUrl(sessionInfo.session.currentUrl)
          }
          
          results.push({
            step: step,
            result: response,
            success: true
          })

          // Small delay between steps for better user experience
          await new Promise(resolve => setTimeout(resolve, 1500))

        } catch (stepError: any) {
          console.error(`❌ Step ${i + 1} failed:`, stepError)
          
          results.push({
            step: step,
            result: stepError,
            success: false
          })

          // Ask user if they want to continue or stop on failure
          const shouldContinue = confirm(
            `Step ${i + 1} failed: ${step.description}\\n\\nError: ${stepError.message || 'Unknown error'}\\n\\nDo you want to continue with the remaining steps?`
          )
          
          if (!shouldContinue) {
            console.log('🛑 User chose to stop execution after failure')
            break
          }
        }

        setSequentialExecutionResults([...results])
      }

      const successCount = results.filter(r => r.success).length
      const failureCount = results.length - successCount

      console.log(`🏁 Sequential execution completed: ${successCount} success, ${failureCount} failures`)
      
      // Show final summary
      if (failureCount === 0) {
        alert(`🎉 All ${successCount} steps executed successfully!\\n\\nTest flow validation complete.`)
      } else {
        alert(`⚠️ Execution completed with mixed results:\\n\\n✅ ${successCount} steps succeeded\\n❌ ${failureCount} steps failed\\n\\nCheck the execution details for more information.`)
      }

    } catch (error: any) {
      console.error('❌ Sequential execution failed:', error)
      alert(`Sequential execution failed: ${error.message || 'Unknown error'}`)
    } finally {
      // Clean up browser session
      if (browserSessionToken) {
        try {
          console.log(`🧹 Closing browser session: ${browserSessionToken}`)
          await browserAPI.closeSession(browserSessionToken)
          setBrowserSessionToken(null)
        } catch (cleanupError) {
          console.warn('Failed to close browser session:', cleanupError)
        }
      }
      
      setIsExecutingAllSteps(false)
      setCurrentExecutingStepIndex(-1)
      setCurrentExecutingStep(null)
    }
  }, [steps, projectId]);

  return (
    <div className={`bg-white border-l border-gray-200 flex flex-col h-full ${className}`}>
      {/* Minimal Header - No "Test Builder" text */}
      <div className="border-b border-gray-200 px-4 py-2">
        {selectedElement && (
          <div className="flex justify-end">
            <button
              onClick={onClearSelection}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      {/* Content - Always Show Both Sections */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Element Selection Section - Fixed Height */}
        {selectedElement && (
          <div className="flex-shrink-0 p-3 border-b border-gray-200">
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{selectedElement.description}</div>
                  <div className="text-xs text-gray-500">{selectedElement.elementType}</div>
                </div>
                <button
                  onClick={onClearSelection}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="text-xs font-mono bg-gray-50 p-2 rounded text-gray-700 break-all mb-3">
                {selectedElement.selector}
              </div>

              {/* Action Selection */}
              <div className="space-y-2">
                <select
                  value={newStep.type}
                  onChange={(e) => setNewStep({ ...newStep, type: e.target.value as TestStep['type'] })}
                  className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {stepTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>

                {/* Conditional Input Field */}
                {selectedStepType?.needsValue && (
                  <input
                    type="text"
                    value={newStep.value || ''}
                    onChange={(e) => setNewStep({ ...newStep, value: e.target.value })}
                    placeholder="Enter value..."
                    className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}

                <button
                  onClick={() => {
                    // Validate required fields
                    if (selectedStepType?.needsValue && (!newStep.value || newStep.value.trim() === '')) {
                      alert('Please enter a value for this action type.');
                      return;
                    }

                    // Create the step immediately
                    const stepToAdd = {
                      id: generateId(),
                      type: newStep.type as TestStep['type'],
                      selector: selectedElement.selector,
                      value: selectedStepType?.needsValue ? newStep.value?.trim() : undefined,
                      description: `${selectedStepType?.label} on ${selectedElement.description}`
                    };
                    
                    setSteps([...steps, stepToAdd]);
                    
                    // Reset the action selection
                    setNewStep({
                      type: 'click',
                      selector: '',
                      value: '',
                      description: ''
                    });
                  }}
                  className="w-full px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Add Step
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test Steps Section - Always Visible */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Test Steps Header - Fixed Height */}
          <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">Test Steps ({steps.length})</h3>
              <div className="flex space-x-2">
                <button
                  onClick={handleExecuteAllSteps}
                  disabled={steps.length === 0 || isExecutingAllSteps || isHuntingElements}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  title="Execute all test steps sequentially from starting URL - perfect for flow validation"
                >
                  {isExecutingAllSteps ? (
                    <span className="flex items-center">
                      <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Step {currentExecutingStepIndex + 1}/{steps.length}
                    </span>
                  ) : (
                    '▶️ Execute All Steps'
                  )}
                </button>
                <button
                  onClick={handleHuntNewElements}
                  disabled={steps.length === 0 || isHuntingElements || isExecutingAllSteps}
                  className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  title="Execute test steps and discover new elements that appear after interactions"
                >
                  {isHuntingElements ? (
                    <span className="flex items-center">
                      <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing...
                    </span>
                  ) : (
                    '🔍 Hunt New Elements'
                  )}
                </button>
                <button
                  onClick={() => setSteps([])}
                  disabled={steps.length === 0 || isExecutingAllSteps}
                  className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  title="Clear all test steps"
                >
                  🗑️ Clear All
                </button>
              </div>
            </div>
          </div>

          {/* Test Steps List - Scrollable Area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-3">
              {steps.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {steps.map((step, index) => (
                        <SortableTestStep
                          key={step.id}
                          step={step}
                          index={index}
                          onEdit={() => editStep(step)}
                          onRemove={() => removeStep(step.id)}
                          onLiveExecute={handleLiveExecuteStep}
                          isExecuting={executingStepId === step.id}
                          projectId={projectId}
                        />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay
                    activeStep={activeStep}
                    activeIndex={steps.findIndex(s => s.id === activeStep?.id)}
                  />
                </DndContext>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-2xl mb-2">📝</div>
                  <div className="text-sm text-gray-500">No test steps yet</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {!selectedElement 
                      ? 'Select an element from the library to start building your test'
                      : 'Choose an action and click "Add Step" to build your test'
                    }
                  </div>
                  {!selectedElement && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                      💡 <strong>Tip:</strong> Use the element library on the left to browse and select elements from your project
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save/Cancel Buttons - Always Visible at Bottom */}
        <div className="flex-shrink-0 border-t border-gray-200 p-4">
          <div className="flex space-x-3">
            <button
              onClick={() => {
                onSave?.(steps);
                // Clear localStorage after saving
                if (testId) {
                  localStorage.removeItem(`test-steps-${testId}`);
                }
                setHasUnsavedChanges(false);
              }}
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium ${
                hasUnsavedChanges 
                  ? 'bg-orange-600 hover:bg-orange-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {hasUnsavedChanges ? '⚠️ ' : ''}
              {steps.length > 0 
                ? `Save Test (${steps.length} step${steps.length !== 1 ? 's' : ''})${hasUnsavedChanges ? ' - Unsaved Changes' : ''}` 
                : 'Save Test Configuration'
              }
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Step Modal */}
      {showAddStep && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingStep ? 'Edit Step' : 'Add Test Step'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Action Type
                  </label>
                  <select
                    value={newStep.type}
                    onChange={(e) => setNewStep({ ...newStep, type: e.target.value as TestStep['type'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {stepTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selector
                  </label>
                  <input
                    type="text"
                    value={newStep.selector}
                    onChange={(e) => setNewStep({ ...newStep, selector: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="CSS selector"
                  />
                </div>

                {selectedStepType?.needsValue && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Value
                    </label>
                    <input
                      type="text"
                      value={newStep.value || ''}
                      onChange={(e) => setNewStep({ ...newStep, value: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter value..."
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newStep.description}
                    onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe this step"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={addStep}
                  disabled={!newStep.selector || !newStep.description}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {editingStep ? 'Update Step' : 'Add Step'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Execution Results Modal */}
      {showExecutionModal && executedStep && executionResult && (
        <LiveExecutionModal
          isOpen={showExecutionModal}
          onClose={() => {
            setShowExecutionModal(false);
            setExecutionResult(null);
            setExecutedStep(null);
          }}
          step={executedStep}
          result={executionResult}
        />
      )}

      {/* Sequential Execution Progress Modal */}
      {showSequentialExecutionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full mx-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-green-600 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">▶️ Sequential Steps Execution</h2>
                  <p className="text-sm opacity-90">
                    {isExecutingAllSteps 
                      ? `Executing step ${currentExecutingStepIndex + 1} of ${steps.length}...`
                      : `Completed execution of ${sequentialExecutionResults.length} steps`
                    }
                  </p>
                </div>
                <button
                  onClick={() => setShowSequentialExecutionModal(false)}
                  disabled={isExecutingAllSteps}
                  className="text-white hover:text-gray-200 text-2xl font-bold disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {isExecutingAllSteps && (
              <div className="p-4 border-b border-gray-200">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all duration-500 flex items-center justify-center"
                    style={{ width: `${((currentExecutingStepIndex + 1) / steps.length) * 100}%` }}
                  >
                    {currentExecutingStepIndex >= 0 && (
                      <span className="text-xs text-white font-medium">
                        {Math.round(((currentExecutingStepIndex + 1) / steps.length) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Split Screen Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Side: Live Browser Execution */}
              <div className="w-3/5 border-r border-gray-200" style={{ minHeight: '700px', height: '100%' }}>
                {browserSessionToken ? (
                  <LiveSessionBrowser
                    sessionToken={browserSessionToken}
                    isExecuting={isExecutingAllSteps}
                    currentStep={currentExecutingStep ? {
                      description: currentExecutingStep.description,
                      selector: currentExecutingStep.selector
                    } : undefined}
                    className="w-full h-full"
                  />
                ) : (
                  <BrowserPreview
                    url={currentBrowserUrl || executionStartingUrl || 'https://example.com'}
                    isPickingMode={false}
                    onElementSelected={() => {}}
                    className="w-full h-full"
                  />
                )}
              </div>
              
              {/* Right Side: Steps Progress */}
              <div className="w-2/5 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-2">Execution Progress</h3>
                  <div className="text-sm text-gray-600">
                    {isExecutingAllSteps 
                      ? `Step ${currentExecutingStepIndex + 1} of ${steps.length}`
                      : `Completed: ${sequentialExecutionResults.length}/${steps.length} steps`
                    }
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {steps.map((step, index) => {
                  const result = sequentialExecutionResults.find(r => r.step.id === step.id);
                  const isCurrentlyExecuting = isExecutingAllSteps && index === currentExecutingStepIndex;
                  const isCompleted = !!result;
                  const isSuccess = result?.success;
                  
                  return (
                    <div
                      key={step.id}
                      className={`p-3 rounded-lg border ${
                        isCurrentlyExecuting
                          ? 'border-green-500 bg-green-50'
                          : isCompleted
                          ? isSuccess
                            ? 'border-green-200 bg-green-50'
                            : 'border-red-200 bg-red-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-600">
                              Step {index + 1}
                            </span>
                            {isCurrentlyExecuting && (
                              <svg className="animate-spin h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            )}
                            {isCompleted && (
                              <span className={`text-lg ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>
                                {isSuccess ? '✅' : '❌'}
                              </span>
                            )}
                            {!isCompleted && !isCurrentlyExecuting && (
                              <span className="text-gray-400">⏳</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {step.description}
                            </div>
                            <div className="text-xs text-gray-500">
                              {step.type} • {step.selector}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {result && !result.success && (
                        <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">
                          <strong>Error:</strong> {result.result?.message || 'Unknown error occurred'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              {!isExecutingAllSteps && sequentialExecutionResults.length > 0 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <span className="text-green-600 font-medium">
                      {sequentialExecutionResults.filter(r => r.success).length} succeeded
                    </span>
                    {sequentialExecutionResults.filter(r => !r.success).length > 0 && (
                      <span className="text-red-600 font-medium ml-4">
                        {sequentialExecutionResults.filter(r => !r.success).length} failed
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowSequentialExecutionModal(false)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
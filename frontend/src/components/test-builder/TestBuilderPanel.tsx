import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AlertTriangle,
  Bug,
  Camera,
  CheckCircle2,
  Chrome,
  Clock,
  Eye,
  EyeOff,
  Gauge,
  Loader2,
  Monitor,
  Play,
  PlayCircle,
  Repeat,
  Save,
  Smartphone,
  StepForward,
  Tablet,
  Timer,
  Trash2,
  Video,
  X,
  XCircle,
} from 'lucide-react'
import { projectsAPI, browserAPI } from '../../lib/api'
import { ProjectElement } from '../../types/element.types'
import { TestStep } from '../../types/test.types'
import { LiveExecutionModal } from '../execution/LiveExecutionModal'
import { StepList } from './StepList'
import { useNotification } from '../../contexts/NotificationContext'
import { createLogger } from '../../lib/logger'
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

const logger = createLogger('TestBuilderPanel')

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
  startingUrl?: string // Test's configured starting URL
  pendingStep?: TestStep | null // Step from table cell/row selection
  onPendingStepConsumed?: () => void // Clear pending step after consumption
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
  startingUrl,
  pendingStep,
  onPendingStepConsumed,
  _onAutoAddToTestSteps
}: TestBuilderPanelProps) {
  const { showSuccess, showError, showWarning } = useNotification()
  // Initialize steps with localStorage persistence
  const [steps, setSteps] = useState<TestStep[]>(() => {
    if (testId) {
      const savedSteps = localStorage.getItem(`nomation-test-steps-v1-${testId}`);
      if (savedSteps) {
        try {
          const parsedSteps = JSON.parse(savedSteps);
          // Always return saved steps if they exist (user has unsaved changes)
          return parsedSteps;
        } catch (e) {
          logger.warn('Failed to parse saved steps', e);
          localStorage.removeItem(`nomation-test-steps-v1-${testId}`); // Clean up corrupted data
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

  // NEW: Video timestamp highlighting (for G1.3)
  const [activeVideoStepId, setActiveVideoStepId] = useState<string | null>(null);
  
  // NEW: Template Modal State

  // Execution mode selection
  const [showExecutionModeModal, setShowExecutionModeModal] = useState(false);

  // Debug mode state
  const [debugMode, setDebugMode] = useState(false);
  const [debugStepIndex, setDebugStepIndex] = useState(0);
  const [debugStepResult, setDebugStepResult] = useState<any>(null);
  const [isDebugPaused, setIsDebugPaused] = useState(true);

  // Step failure confirmation state (replaces blocking confirm())
  const [failedStepMessage, setFailedStepMessage] = useState<string | null>(null);
  const failedStepResolverRef = useRef<((shouldContinue: boolean) => void) | null>(null);

  // Save steps to localStorage whenever they change
  useEffect(() => {
    if (testId) {
      // Always save to localStorage, even if steps array is empty
      localStorage.setItem(`nomation-test-steps-v1-${testId}`, JSON.stringify(steps));
      // Check if steps are different from initial (has unsaved changes)
      const hasChanges = JSON.stringify(steps) !== JSON.stringify(initialSteps);
      setHasUnsavedChanges(hasChanges);
    }
  }, [steps, testId, initialSteps]);

  // Consume pending step from table cell/row selection
  useEffect(() => {
    if (pendingStep) {
      setSteps(prev => [...prev, pendingStep]);
      onPendingStepConsumed?.();

      // Show notification using safe DOM methods
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10B981, #059669);
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
        animation: slideInRight 0.3s ease-out, fadeOut 0.3s ease-out 2.7s;
        max-width: 350px;
      `;

      const title = document.createElement('div');
      title.style.cssText = 'font-weight: 600; margin-bottom: 4px;';
      title.textContent = 'Step added';

      const desc = document.createElement('div');
      desc.style.cssText = 'font-size: 12px; opacity: 0.9;';
      desc.textContent = pendingStep.description;

      notification.appendChild(title);
      notification.appendChild(desc);

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
      setTimeout(() => { if (notification.parentNode) notification.remove(); }, 3000);
    }
  }, [pendingStep, onPendingStepConsumed]);

  // NEW: Auto-add functionality for live element picker integration
  const _handleAutoAddTestStep = useCallback((element: ProjectElement, action?: string) => {
    if (!element || !element.selector) {
      logger.warn('Cannot auto-add test step: Invalid element data');
      return;
    }

    // Validate and type-cast action parameter
    const validTypes: TestStep['type'][] = ['click', 'type', 'wait', 'assert', 'hover', 'scroll', 'select', 'clear', 'doubleclick', 'rightclick', 'press', 'upload', 'check', 'uncheck', 'screenshot', 'navigate'];
    const actionType: TestStep['type'] = (action && validTypes.includes(action as TestStep['type']))
      ? action as TestStep['type']
      : getDefaultActionForElement(element.elementType);
    const stepId = generateId();

    const newTestStep: TestStep = {
      id: stepId,
      type: actionType,
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
        logger.debug('Step already exists, highlighting existing step');
        // Visual feedback for existing step
        showAutoAddNotification(element, actionType, true);
        return prevSteps;
      }

      logger.info(`Auto-added test step: ${newTestStep.description}`);
      // Show success notification with highlighting
      showAutoAddNotification(element, actionType, false);
      return [...prevSteps, newTestStep];
    });
  }, []); // Empty deps: uses functional update pattern, doesn't need steps

  // Helper function to get default action for element type
  const getDefaultActionForElement = (elementType: string): TestStep['type'] => {
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
    const title = isExisting ? 'Step already exists!' : 'Auto-added to test steps!';
    const message = `${action.toUpperCase()} — ${element.description}`;
    if (isExisting) {
      showWarning(title, message);
    } else {
      showSuccess(title, message);
    }
  };

  // Update steps when initialSteps changes (but prevent during execution)
  useEffect(() => {
    // CRITICAL: Don't update steps during execution to prevent component re-renders
    if (isExecutingAllSteps) {
      return;
    }
    
    if (initialSteps.length > 0 && testId) {
      // Check if localStorage has data
      const savedSteps = localStorage.getItem(`nomation-test-steps-v1-${testId}`);
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

  // Clean up browser session on unmount
  useEffect(() => {
    return () => {
      if (browserSessionToken) {
        browserAPI.closeSession(browserSessionToken).catch(() => {});
      }
    };
  }, [browserSessionToken]);

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
    { value: 'navigate', label: 'Navigate to URL', needsValue: true },
    { value: 'screenshot', label: 'Take Screenshot', needsValue: false },
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
      showError('Execution Error', 'Project ID is required to execute steps live.')
      return
    }

    setExecutingStepId(step.id)
    try {
      logger.debug(`Live executing step: ${step.description}`)

      // Use shared browser session approach (same as sequential execution)
      let sessionToken = browserSessionToken

      // If no active session, create one
      if (!sessionToken) {
        logger.debug('Creating browser session for single step execution...')
        const project = await projectsAPI.getById(projectId)
        const url = startingUrl || project.data.urls?.[0]?.url || 'https://example.com'

        const sessionResponse = await browserAPI.createSession(projectId, undefined, url)
        sessionToken = sessionResponse.sessionToken
        setBrowserSessionToken(sessionToken)

        // Navigate to starting URL
        await browserAPI.navigateSession(sessionToken!, url)
        setCurrentBrowserUrl(url)
        logger.info(`Browser session created and navigated to: ${url}`)
      }

      // Convert test step to browser action format — pass through directly, backend handles all types
      const action = { type: step.type, selector: step.selector, value: step.value || '' }

      // Execute action in shared browser session
      const response = await browserAPI.executeAction(sessionToken!, action)
      logger.debug('Step executed', response)
      
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
      logger.error('Live step execution failed', error)
      
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

  // NEW: Sequential execution of all steps (wrapped in useCallback to prevent re-renders)
  const handleExecuteAllSteps = useCallback(async () => {
    if (steps.length === 0 || !projectId) {
      showWarning('No Steps', 'Please add some test steps first to execute the complete flow.')
      return
    }

    setIsExecutingAllSteps(true)
    setCurrentExecutingStepIndex(-1)
    setSequentialExecutionResults([])
    setShowSequentialExecutionModal(true)

    // Local var so the finally block can clean up regardless of state-closure timing.
    // The setBrowserSessionToken state update doesn't reach the finally closure.
    let localSessionToken: string | null = null

    try {
      logger.info(`Starting sequential execution of ${steps.length} steps`)

      // Get project data to extract starting URL
      const project = await projectsAPI.getById(projectId)
      logger.debug('URLs array:', project.data.urls?.[0])
      const url = startingUrl || project.data.urls?.[0]?.url || 'https://example.com'
      logger.debug(`startingUrl type: ${typeof url}, value: ${url}`)

      logger.info(`Starting URL: ${url}`)

      // Set URL for browser execution view
      setExecutionStartingUrl(url)
      setCurrentBrowserUrl(url)

      // Create shared browser session for live execution
      logger.debug('Creating shared browser session...')
      const sessionResponse = await browserAPI.createSession(projectId, undefined, url)
      const sessionToken = sessionResponse.sessionToken
      localSessionToken = sessionToken
      setBrowserSessionToken(sessionToken)
      logger.info(`Browser session created: ${sessionToken}`)

      // Navigate to starting URL in the session
      logger.debug(`Navigating session to: ${url}`)
      await browserAPI.navigateSession(sessionToken, url)
      logger.debug('Navigation completed')

      const results: Array<{step: TestStep, result: any, success: boolean}> = []

      // Execute each step sequentially in the shared session
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        setCurrentExecutingStepIndex(i)
        setCurrentExecutingStep(step)

        logger.debug(`Executing step ${i + 1}/${steps.length}: ${step.description}`)

        try {
          // Convert test step to browser action format — pass through directly, backend handles all types
          const action = { type: step.type, selector: step.selector, value: step.value || '' }

          // Execute action in shared browser session
          const response = await browserAPI.executeAction(sessionToken, action)
          logger.debug(`Step ${i + 1} completed`, response)
          
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
          logger.error(`Step ${i + 1} failed`, stepError)
          
          results.push({
            step: step,
            result: stepError,
            success: false
          })

          // Ask user if they want to continue or stop on failure
          const shouldContinue = await new Promise<boolean>((resolve) => {
            failedStepResolverRef.current = resolve
            setFailedStepMessage(
              `Step ${i + 1} failed: ${step.description}\n\nError: ${stepError.message || 'Unknown error'}\n\nDo you want to continue with the remaining steps?`
            )
          })

          if (!shouldContinue) {
            logger.info('User chose to stop execution after failure')
            break
          }
        }

        setSequentialExecutionResults([...results])
      }

      const successCount = results.filter(r => r.success).length
      const failureCount = results.length - successCount

      logger.info(`Sequential execution completed: ${successCount} success, ${failureCount} failures`)
      
      // Show final summary
      if (failureCount === 0) {
        showSuccess('All Steps Passed', `All ${successCount} steps executed successfully. Test flow validation complete.`)
      } else {
        showWarning('Mixed Results', `${successCount} steps succeeded, ${failureCount} steps failed. Check the execution details for more information.`)
      }

    } catch (error: any) {
      logger.error('Sequential execution failed', error)
      showError('Execution Failed', `Sequential execution failed: ${error.message || 'Unknown error'}`)
    } finally {
      // Clean up browser session — read from the local var because the state
      // closure captured `browserSessionToken` from the render where this
      // callback was created (often null), so checking state would skip cleanup.
      if (localSessionToken) {
        try {
          logger.debug(`Closing browser session: ${localSessionToken}`)
          await browserAPI.closeSession(localSessionToken)
          setBrowserSessionToken(null)
        } catch (cleanupError) {
          logger.warn('Failed to close browser session', cleanupError)
        }
      }

      setIsExecutingAllSteps(false)
      setCurrentExecutingStepIndex(-1)
      setCurrentExecutingStep(null)
    }
  }, [steps, projectId, startingUrl, showError, showSuccess, showWarning]);

  // Normal mode: delegates to existing handleExecuteAllSteps logic
  const startNormalExecution = () => {
    handleExecuteAllSteps();
  };

  // Debug mode: creates session and executes step-by-step
  const startDebugExecution = async () => {
    if (steps.length === 0 || !projectId) {
      showWarning('No Steps', 'Please add some test steps first.');
      return;
    }

    try {
      logger.info('Starting debug execution');

      const project = await projectsAPI.getById(projectId);
      const url = startingUrl || project.data.urls?.[0]?.url || 'https://example.com';

      const sessionResponse = await browserAPI.createSession(projectId, undefined, url);
      const token = sessionResponse.sessionToken;
      setBrowserSessionToken(token);

      await browserAPI.navigateSession(token, url);
      setCurrentBrowserUrl(url);

      setDebugMode(true);
      setDebugStepIndex(0);
      setDebugStepResult(null);
      setIsDebugPaused(true);

      logger.info(`Debug session created, navigated to: ${url}`);
    } catch (error: any) {
      logger.error('Failed to start debug execution', error);
      showError('Debug Start Failed', error.message || 'Could not create browser session.');
    }
  };

  // Execute the next debug step
  const executeNextDebugStep = async () => {
    if (debugStepIndex >= steps.length) return;
    setIsDebugPaused(false);
    setDebugStepResult(null);

    try {
      const step = steps[debugStepIndex];
      const action = { type: step.type, selector: step.selector, value: step.value || '' };
      const result = await browserAPI.executeAction(browserSessionToken!, action);

      // Update URL from session
      const sessionInfo = await browserAPI.getSessionInfo(browserSessionToken!);
      if (sessionInfo.session?.currentUrl) {
        setCurrentBrowserUrl(sessionInfo.session.currentUrl);
      }

      setDebugStepResult({ success: true, ...result });
    } catch (error: any) {
      setDebugStepResult({ success: false, error: error.response?.data?.message || error.message || 'Unknown error' });
    }

    setIsDebugPaused(true);
    setDebugStepIndex(prev => prev + 1);
  };

  // Stop debug execution and clean up
  const stopDebugExecution = () => {
    setDebugMode(false);
    setDebugStepIndex(0);
    setDebugStepResult(null);
    if (browserSessionToken) {
      browserAPI.closeSession(browserSessionToken).catch(() => {});
      setBrowserSessionToken(null);
    }
  };

  return (
    <div
      className={`col ${className}`}
      style={{
        background: 'var(--paper)',
        borderLeft: '1px solid var(--hair)',
        height: '100%',
      }}
    >
      {/* Minimal Header */}
      <div
        style={{
          borderBottom: '1px solid var(--hair)',
          padding: '6px 12px',
          minHeight: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        {selectedElement && (
          <button
            type="button"
            onClick={onClearSelection}
            className="btn btn-ghost btn-sm"
            title="Clear element selection"
          >
            <X size={12} />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="col" style={{ flex: 1, minHeight: 0 }}>
        {/* Element Selection */}
        {selectedElement && (
          <div
            style={{
              flexShrink: 0,
              padding: 12,
              borderBottom: '1px solid var(--hair)',
            }}
          >
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--hair)',
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div className="row" style={{ alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selectedElement.description}
                  </div>
                  <div className="dim" style={{ fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {selectedElement.elementType}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="icon-btn"
                  aria-label="Clear selection"
                >
                  <X size={12} />
                </button>
              </div>

              <code
                className="mono"
                style={{
                  display: 'block',
                  fontSize: 11,
                  background: 'var(--surface-2)',
                  padding: '6px 8px',
                  borderRadius: 4,
                  color: 'var(--slate)',
                  wordBreak: 'break-all',
                  marginBottom: 10,
                  border: '1px solid var(--hair)',
                }}
              >
                {selectedElement.selector}
              </code>

              <div className="col" style={{ gap: 8 }}>
                <select
                  className="field"
                  value={newStep.type}
                  onChange={(e) => setNewStep({ ...newStep, type: e.target.value as TestStep['type'] })}
                  style={{ fontSize: 12.5, padding: '6px 8px' }}
                >
                  {stepTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>

                {selectedStepType?.needsValue && (
                  <input
                    type="text"
                    className="field"
                    value={newStep.value || ''}
                    onChange={(e) => setNewStep({ ...newStep, value: e.target.value })}
                    placeholder="Enter value…"
                    style={{ fontSize: 12.5, padding: '6px 8px' }}
                  />
                )}

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    if (selectedStepType?.needsValue && (!newStep.value || newStep.value.trim() === '')) {
                      showWarning('Value Required', 'Please enter a value for this action type.');
                      return;
                    }

                    const stepToAdd = {
                      id: generateId(),
                      type: newStep.type as TestStep['type'],
                      selector: selectedElement.selector,
                      value: selectedStepType?.needsValue ? newStep.value?.trim() : undefined,
                      description: `${selectedStepType?.label} on ${selectedElement.description}`
                    };

                    setSteps([...steps, stepToAdd]);

                    setNewStep({
                      type: 'click',
                      selector: '',
                      value: '',
                      description: ''
                    });
                  }}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Add Step
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test Steps Section */}
        <div className="col" style={{ flex: 1, minHeight: 0 }}>
          {/* Action bar */}
          <div
            style={{
              flexShrink: 0,
              padding: '8px 12px',
              borderBottom: '1px solid var(--hair)',
              background: 'var(--surface)',
            }}
          >
            <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
                <span
                  style={{
                    fontFamily: 'Inter Tight',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--ink)',
                  }}
                >
                  Test Steps
                </span>
                <span
                  className="tabular"
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-3)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--hair)',
                    padding: '1px 7px',
                    borderRadius: 999,
                  }}
                >
                  {steps.length}
                </span>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <button
                  type="button"
                  className={hasUnsavedChanges ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                  onClick={() => {
                    onSave?.(steps);
                    if (testId) {
                      localStorage.removeItem(`nomation-test-steps-v1-${testId}`);
                    }
                    setHasUnsavedChanges(false);
                  }}
                  title={hasUnsavedChanges ? 'Save unsaved changes' : 'Save test'}
                  style={hasUnsavedChanges ? { background: 'var(--amber)', borderColor: 'var(--amber)' } : undefined}
                >
                  {hasUnsavedChanges ? <AlertTriangle size={12} /> : <Save size={12} />}
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={onCancel}
                  title="Cancel and exit"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowExecutionModeModal(true)}
                  disabled={steps.length === 0 || isExecutingAllSteps || debugMode}
                  className="btn btn-success btn-sm"
                  title="Execute all test steps sequentially from starting URL"
                  style={steps.length === 0 || isExecutingAllSteps || debugMode ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                >
                  {isExecutingAllSteps ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span className="tabular">{currentExecutingStepIndex + 1}/{steps.length}</span>
                    </>
                  ) : (
                    <>
                      <Play size={12} />
                      <span>Run</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSteps([])}
                  disabled={steps.length === 0 || isExecutingAllSteps}
                  className="icon-btn"
                  title="Clear all test steps"
                  style={steps.length === 0 || isExecutingAllSteps ? { opacity: 0.4, cursor: 'not-allowed', color: 'var(--ink-3)' } : { color: 'var(--clay)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Test Steps List */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, background: 'var(--bone)' }}>
            <div style={{ padding: 12 }}>
              {steps.length > 0 ? (
                <StepList
                  steps={steps}
                  onStepsChange={setSteps}
                  onEditStep={editStep}
                  onRemoveStep={removeStep}
                  onLiveExecuteStep={handleLiveExecuteStep}
                  executingStepId={executingStepId}
                  projectId={projectId}
                  activeVideoStepId={activeVideoStepId}
                />
              ) : (
                <div className="empty" style={{ padding: '32px 16px' }}>
                  <div className="empty-icon">
                    <PlayCircle size={20} />
                  </div>
                  <h3>No test steps yet</h3>
                  <p>
                    {!selectedElement
                      ? 'Select an element from the library to start building your test.'
                      : 'Choose an action above and click "Add Step".'}
                  </p>
                  {!selectedElement && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 10,
                        background: 'var(--moss-soft)',
                        border: '1px solid var(--moss-edge)',
                        borderRadius: 6,
                        fontSize: 11.5,
                        color: 'var(--ink-2)',
                        textAlign: 'left',
                        maxWidth: 320,
                      }}
                    >
                      <strong style={{ color: 'var(--moss)' }}>Tip:</strong> use the element
                      library on the left to browse and pick elements from your project.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Debug Mode Panel */}
        {debugMode && (
          <div
            style={{
              flexShrink: 0,
              margin: 12,
              padding: 14,
              background: 'var(--amber-soft)',
              border: '1px solid var(--amber-edge)',
              borderRadius: 8,
            }}
          >
            <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <Bug size={14} style={{ color: 'var(--amber)' }} />
                <span style={{ fontFamily: 'Inter Tight', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  Debug Mode — Step {Math.min(debugStepIndex + 1, steps.length)} of {steps.length}
                </span>
              </div>
              <span
                className="pill"
                style={{
                  background: isDebugPaused ? 'var(--amber-soft)' : 'var(--moss-soft)',
                  color: isDebugPaused ? 'var(--amber)' : 'var(--moss)',
                  borderColor: isDebugPaused ? 'var(--amber-edge)' : 'var(--moss-edge)',
                }}
              >
                {isDebugPaused ? 'Paused' : 'Running…'}
              </span>
            </div>

            {debugStepIndex < steps.length && (
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 10, lineHeight: 1.6 }}>
                <div><strong style={{ color: 'var(--ink)' }}>Action:</strong> {steps[debugStepIndex]?.type}</div>
                <div><strong style={{ color: 'var(--ink)' }}>Selector:</strong> <code className="mono" style={{ fontSize: 11, color: 'var(--slate)' }}>{steps[debugStepIndex]?.selector}</code></div>
                {steps[debugStepIndex]?.value && <div><strong style={{ color: 'var(--ink)' }}>Value:</strong> {steps[debugStepIndex]?.value}</div>}
              </div>
            )}

            {debugStepIndex >= steps.length && (
              <div className="row" style={{ gap: 6, fontSize: 12.5, color: 'var(--moss)', fontWeight: 600, marginBottom: 10 }}>
                <CheckCircle2 size={14} />
                <span>All steps have been executed.</span>
              </div>
            )}

            {debugStepResult && (
              <div
                className="row"
                style={{
                  gap: 6,
                  alignItems: 'flex-start',
                  fontSize: 12.5,
                  padding: 8,
                  borderRadius: 6,
                  marginBottom: 10,
                  background: debugStepResult.success ? 'var(--moss-soft)' : 'var(--clay-soft)',
                  border: `1px solid ${debugStepResult.success ? 'var(--moss-edge)' : 'var(--clay-edge)'}`,
                  color: debugStepResult.success ? 'var(--moss)' : 'var(--clay)',
                }}
              >
                {debugStepResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                <span>
                  {debugStepResult.success
                    ? `Step ${debugStepIndex} passed`
                    : `Step ${debugStepIndex} failed: ${debugStepResult.error}`}
                </span>
              </div>
            )}

            <div className="row" style={{ gap: 6 }}>
              <button
                type="button"
                onClick={executeNextDebugStep}
                disabled={!isDebugPaused || debugStepIndex >= steps.length}
                className="btn btn-primary btn-sm"
                style={!isDebugPaused || debugStepIndex >= steps.length ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                <StepForward size={12} />
                <span>{debugStepIndex >= steps.length - 1 ? 'Execute last step' : 'Next step'}</span>
              </button>
              <button
                type="button"
                onClick={stopDebugExecution}
                className="btn btn-ghost btn-sm"
              >
                Stop debug
              </button>
            </div>
          </div>
        )}

        {/* Compact unsaved-changes hint at the bottom */}
        {hasUnsavedChanges && (
          <div
            style={{
              flexShrink: 0,
              borderTop: '1px solid var(--amber-edge)',
              padding: '8px 16px',
              background: 'var(--amber-soft)',
              fontSize: 11.5,
              color: 'var(--amber)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AlertTriangle size={12} />
            <span>
              {steps.length} step{steps.length !== 1 ? 's' : ''} with unsaved changes — click Save in the panel header.
            </span>
          </div>
        )}
      </div>

      {/* Add/Edit Step Modal */}
      {showAddStep && (
        <div className="modal-backdrop" onClick={cancelEdit}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">{editingStep ? 'Edit Step' : 'Add Test Step'}</div>
              <button type="button" className="icon-btn" onClick={cancelEdit} aria-label="Close">
                <X size={14} />
              </button>
            </div>
            <div className="modal-body col" style={{ gap: 12 }}>
              <div className="col" style={{ gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                  Action type
                </label>
                <select
                  className="field"
                  value={newStep.type}
                  onChange={(e) => setNewStep({ ...newStep, type: e.target.value as TestStep['type'] })}
                >
                  {stepTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col" style={{ gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                  Selector
                </label>
                <input
                  type="text"
                  className="field mono"
                  value={newStep.selector}
                  onChange={(e) => setNewStep({ ...newStep, selector: e.target.value })}
                  placeholder="CSS selector"
                />
              </div>

              {selectedStepType?.needsValue && (
                <div className="col" style={{ gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                    Value
                  </label>
                  <input
                    type="text"
                    className="field"
                    value={newStep.value || ''}
                    onChange={(e) => setNewStep({ ...newStep, value: e.target.value })}
                    placeholder="Enter value…"
                  />
                </div>
              )}

              <div className="col" style={{ gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                  Description
                </label>
                <input
                  type="text"
                  className="field"
                  value={newStep.description}
                  onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                  placeholder="Describe this step"
                />
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                Cancel
              </button>
              <button
                type="button"
                onClick={addStep}
                disabled={!newStep.selector || !newStep.description}
                className="btn btn-primary"
                style={!newStep.selector || !newStep.description ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                {editingStep ? 'Update Step' : 'Add Step'}
              </button>
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

      {/* Execution Mode Selection Modal — full featured picker */}
      {showExecutionModeModal && (
        <TestBuilderRunModal
          onCancel={() => setShowExecutionModeModal(false)}
          onPick={(mode) => {
            setShowExecutionModeModal(false);
            if (mode === 'debug') startDebugExecution();
            else startNormalExecution();
          }}
        />
      )}

      {/* Sequential Execution Progress Modal */}
      {showSequentialExecutionModal && (
        <div className="modal-backdrop">
          <div className="modal modal-lg" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-head">
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <PlayCircle size={16} style={{ color: 'var(--moss)' }} />
                <div>
                  <div className="modal-title">Sequential steps execution</div>
                  <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
                    {isExecutingAllSteps
                      ? `Executing step ${currentExecutingStepIndex + 1} of ${steps.length}…`
                      : `Completed execution of ${sequentialExecutionResults.length} steps`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowSequentialExecutionModal(false)}
                disabled={isExecutingAllSteps}
                aria-label="Close"
                style={isExecutingAllSteps ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                <X size={14} />
              </button>
            </div>

            {/* Progress Bar */}
            {isExecutingAllSteps && (
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--hair)' }}>
                <div
                  style={{
                    width: '100%',
                    height: 6,
                    background: 'var(--surface-2)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${((currentExecutingStepIndex + 1) / steps.length) * 100}%`,
                      height: '100%',
                      background: 'var(--moss)',
                      transition: 'width .5s ease',
                    }}
                  />
                </div>
                {currentExecutingStepIndex >= 0 && (
                  <div className="dim tabular" style={{ fontSize: 10.5, textAlign: 'right', marginTop: 4 }}>
                    {Math.round(((currentExecutingStepIndex + 1) / steps.length) * 100)}%
                  </div>
                )}
              </div>
            )}

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
              <div className="col" style={{ gap: 8 }}>
                {steps.map((step, index) => {
                  const result = sequentialExecutionResults.find(r => r.step.id === step.id);
                  const isCurrentlyExecuting = isExecutingAllSteps && index === currentExecutingStepIndex;
                  const isCompleted = !!result;
                  const isSuccess = result?.success;

                  let bg = 'var(--surface-2)';
                  let border = 'var(--hair)';
                  if (isCurrentlyExecuting) {
                    bg = 'var(--moss-soft)';
                    border = 'var(--moss)';
                  } else if (isCompleted) {
                    bg = isSuccess ? 'var(--moss-soft)' : 'var(--clay-soft)';
                    border = isSuccess ? 'var(--moss-edge)' : 'var(--clay-edge)';
                  }

                  return (
                    <div
                      key={step.id}
                      style={{
                        padding: 10,
                        borderRadius: 6,
                        border: `1px solid ${border}`,
                        background: bg,
                      }}
                    >
                      <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                        <span
                          className="tabular"
                          style={{
                            fontSize: 11,
                            color: 'var(--ink-3)',
                            background: 'var(--surface)',
                            padding: '1px 6px',
                            borderRadius: 4,
                            border: '1px solid var(--hair)',
                            flexShrink: 0,
                          }}
                        >
                          {index + 1}
                        </span>
                        <span style={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 18 }}>
                          {isCurrentlyExecuting && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--moss)' }} />}
                          {isCompleted && isSuccess && <CheckCircle2 size={14} style={{ color: 'var(--moss)' }} />}
                          {isCompleted && !isSuccess && <XCircle size={14} style={{ color: 'var(--clay)' }} />}
                          {!isCompleted && !isCurrentlyExecuting && <Clock size={14} style={{ color: 'var(--ink-3)' }} />}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12.5,
                              fontWeight: 500,
                              color: 'var(--ink)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {step.description}
                          </div>
                          <div className="dim mono" style={{ fontSize: 11, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {step.type} • {step.selector}
                          </div>
                        </div>
                      </div>

                      {result && !result.success && (
                        <div
                          className="row"
                          style={{
                            gap: 6,
                            alignItems: 'flex-start',
                            marginTop: 8,
                            padding: 8,
                            background: 'var(--clay-soft)',
                            border: '1px solid var(--clay-edge)',
                            borderRadius: 4,
                            fontSize: 11.5,
                            color: 'var(--clay)',
                          }}
                        >
                          <AlertTriangle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
                          <span>
                            <strong>Error:</strong> {result.result?.message || 'Unknown error occurred'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-foot">
              {!isExecutingAllSteps && sequentialExecutionResults.length > 0 ? (
                <>
                  <div className="row" style={{ gap: 12, fontSize: 12, marginRight: 'auto' }}>
                    <span className="row" style={{ gap: 4, color: 'var(--moss)', fontWeight: 600 }}>
                      <CheckCircle2 size={12} />
                      {sequentialExecutionResults.filter(r => r.success).length} succeeded
                    </span>
                    {sequentialExecutionResults.filter(r => !r.success).length > 0 && (
                      <span className="row" style={{ gap: 4, color: 'var(--clay)', fontWeight: 600 }}>
                        <XCircle size={12} />
                        {sequentialExecutionResults.filter(r => !r.success).length} failed
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowSequentialExecutionModal(false)}
                  >
                    Close
                  </button>
                </>
              ) : (
                <span className="dim" style={{ fontSize: 11.5 }}>Execution in progress…</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step failure confirmation dialog */}
      {failedStepMessage && (
        <div className="modal-backdrop" style={{ zIndex: 60 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={16} style={{ color: 'var(--clay)', marginTop: 1 }} />
                <div className="modal-title">Step failed</div>
              </div>
            </div>
            <div className="modal-body">
              <p
                style={{
                  fontSize: 12.5,
                  color: 'var(--ink-2)',
                  whiteSpace: 'pre-line',
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {failedStepMessage}
              </p>
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setFailedStepMessage(null);
                  failedStepResolverRef.current?.(false);
                  failedStepResolverRef.current = null;
                }}
              >
                Stop execution
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setFailedStepMessage(null);
                  failedStepResolverRef.current?.(true);
                  failedStepResolverRef.current = null;
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Full-featured run modal for the test builder. Mirrors RunModePickerModal's
// shape (same browser/viewport/capture/timing options) and adds a third "Debug"
// run mode for step-by-step execution. Options not yet wired carry a "soon" pill
// so the user sees what's planned vs functional today.
// ─────────────────────────────────────────────────────────────────────────────
type RunChoice = 'normal-headed' | 'normal-headless' | 'debug';

function TestBuilderRunModal({
  onCancel,
  onPick,
}: {
  onCancel: () => void;
  onPick: (mode: RunChoice) => void;
}) {
  const [mode, setMode] = useState<RunChoice>('normal-headed');
  const [browser, setBrowser] = useState<'chromium' | 'firefox' | 'webkit'>('chromium');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [recordVideo, setRecordVideo] = useState(true);
  const [screenshotsOnFailure, setScreenshotsOnFailure] = useState(true);
  const [slowMotionMs, setSlowMotionMs] = useState(0);
  const [stepTimeoutSec, setStepTimeoutSec] = useState(30);
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleStart = () => onPick(mode);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-head">
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: 'var(--moss-soft)',
                color: 'var(--moss)',
                border: '1px solid var(--moss-edge)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Play size={16} />
            </span>
            <div>
              <div className="modal-title">Run test</div>
              <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
                Choose how this test should run and tweak execution options.
              </div>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="modal-body col" style={{ gap: 18, overflowY: 'auto' }}>
          {/* Run mode */}
          <RunSection label="Run mode" required>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <RunChoiceCard
                active={mode === 'normal-headed'}
                onClick={() => setMode('normal-headed')}
                Icon={Eye}
                title="Headed"
                tone="info"
                description="Real Chromium window opens. Watch the test execute live."
              />
              <RunChoiceCard
                active={mode === 'normal-headless'}
                onClick={() => setMode('normal-headless')}
                Icon={EyeOff}
                title="Headless"
                tone="moss"
                description="No browser window. Faster on busy machines. Same recording."
              />
              <RunChoiceCard
                active={mode === 'debug'}
                onClick={() => setMode('debug')}
                Icon={Bug}
                title="Debug"
                tone="amber"
                description="Step-by-step. Click Next after each step. Inspect results."
              />
            </div>
          </RunSection>

          <RunSection label="Browser engine">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <RunSmallChoice
                active={browser === 'chromium'}
                onClick={() => setBrowser('chromium')}
                Icon={Chrome}
                title="Chromium"
              />
              <RunSmallChoice
                active={browser === 'firefox'}
                onClick={() => setBrowser('firefox')}
                Icon={Chrome}
                title="Firefox"
                soon
              />
              <RunSmallChoice
                active={browser === 'webkit'}
                onClick={() => setBrowser('webkit')}
                Icon={Chrome}
                title="WebKit"
                soon
              />
            </div>
          </RunSection>

          <RunSection label="Viewport preset">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <RunSmallChoice
                active={viewport === 'desktop'}
                onClick={() => setViewport('desktop')}
                Icon={Monitor}
                title="Desktop"
                subtitle="1280 × 720"
              />
              <RunSmallChoice
                active={viewport === 'tablet'}
                onClick={() => setViewport('tablet')}
                Icon={Tablet}
                title="Tablet"
                subtitle="820 × 1180"
                soon
              />
              <RunSmallChoice
                active={viewport === 'mobile'}
                onClick={() => setViewport('mobile')}
                Icon={Smartphone}
                title="Mobile"
                subtitle="390 × 844"
                soon
              />
            </div>
          </RunSection>

          <RunSection label="Capture">
            <div className="col" style={{ gap: 8 }}>
              <RunToggleRow
                Icon={Video}
                title="Record video"
                description="Save a recording of the run."
                checked={recordVideo}
                onChange={setRecordVideo}
              />
              <RunToggleRow
                Icon={Camera}
                title="Screenshot on failure"
                description="Capture a screenshot the moment a step fails."
                checked={screenshotsOnFailure}
                onChange={setScreenshotsOnFailure}
              />
            </div>
          </RunSection>

          <RunSection label="Timing & retries">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <RunNumberField
                Icon={Timer}
                label="Step timeout"
                suffix="s"
                value={stepTimeoutSec}
                onChange={setStepTimeoutSec}
                min={5}
                max={300}
                step={5}
                soon
              />
              <RunNumberField
                Icon={Gauge}
                label="Slow-mo"
                suffix="ms"
                value={slowMotionMs}
                onChange={setSlowMotionMs}
                min={0}
                max={2000}
                step={50}
                soon
              />
              <RunNumberField
                Icon={Repeat}
                label="Retries on fail"
                suffix=""
                value={retries}
                onChange={setRetries}
                min={0}
                max={5}
                step={1}
                soon
              />
            </div>
          </RunSection>

          <div
            className="row"
            style={{
              gap: 8,
              alignItems: 'flex-start',
              padding: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--hair)',
              borderRadius: 6,
              fontSize: 11.5,
              color: 'var(--ink-3)',
            }}
          >
            <Loader2 size={12} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>
              Options marked <strong style={{ color: 'var(--ink-2)' }}>soon</strong> are visible
              now and will be wired in an upcoming release. Run mode and capture toggles work today.
            </span>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleStart}>
            <Play size={13} />
            <span>Start run</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function RunSection({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="col" style={{ gap: 6 }}>
      <div
        className="dim"
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--clay)', marginLeft: 4 }}>*</span>}
      </div>
      {children}
    </div>
  );
}

function RunChoiceCard({
  active,
  onClick,
  Icon,
  title,
  description,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Eye;
  title: string;
  description: string;
  tone: 'info' | 'moss' | 'amber';
}) {
  const toneFg = tone === 'info' ? 'var(--info)' : tone === 'moss' ? 'var(--moss)' : 'var(--amber)';
  const toneBg = tone === 'info' ? 'var(--info-soft)' : tone === 'moss' ? 'var(--moss-soft)' : 'var(--amber-soft)';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        textAlign: 'left',
        background: active ? toneBg : 'var(--surface)',
        borderWidth: 2,
        borderStyle: 'solid',
        borderColor: active ? toneFg : 'var(--hair)',
        borderRadius: 8,
        padding: 12,
        cursor: 'pointer',
        transition: 'border-color .15s ease, background .15s ease, box-shadow .15s ease',
        position: 'relative',
        boxShadow: active ? `0 0 0 3px ${toneBg}` : 'none',
      }}
    >
      {active && (
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: toneFg,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 9,
            fontWeight: 700,
          }}
          aria-hidden="true"
        >
          ✓
        </span>
      )}
      <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 4 }}>
        <Icon size={13} style={{ color: toneFg }} />
        <span
          style={{
            fontFamily: 'Inter Tight',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--ink)',
          }}
        >
          {title}
        </span>
      </div>
      <div className="dim" style={{ fontSize: 11, lineHeight: 1.5, paddingRight: 18 }}>
        {description}
      </div>
    </button>
  );
}

function RunSmallChoice({
  active,
  onClick,
  Icon,
  title,
  subtitle,
  soon,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Monitor;
  title: string;
  subtitle?: string;
  soon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      disabled={soon}
      aria-pressed={active}
      style={{
        textAlign: 'left',
        background: active ? 'var(--moss-soft)' : 'var(--surface)',
        borderWidth: active ? 2 : 1,
        borderStyle: 'solid',
        borderColor: active ? 'var(--moss)' : 'var(--hair)',
        borderRadius: 6,
        padding: 10,
        cursor: soon ? 'not-allowed' : 'pointer',
        opacity: soon ? 0.6 : 1,
        transition: 'border-color .12s ease, background .12s ease',
      }}
    >
      <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 2 }}>
        <Icon size={12} style={{ color: active ? 'var(--moss)' : 'var(--ink-2)' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{title}</span>
        {soon && <RunSoonPill />}
      </div>
      {subtitle && (
        <div className="mono dim" style={{ fontSize: 10.5 }}>
          {subtitle}
        </div>
      )}
    </button>
  );
}

function RunToggleRow({
  Icon,
  title,
  description,
  checked,
  onChange,
}: {
  Icon: typeof Video;
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className="row"
      style={{
        gap: 10,
        alignItems: 'flex-start',
        padding: 10,
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 6,
        cursor: 'pointer',
      }}
    >
      <Icon size={13} style={{ color: 'var(--ink-2)', marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
        <p className="dim" style={{ margin: '2px 0 0', fontSize: 11.5, lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: 'var(--moss)', flexShrink: 0, marginTop: 2 }}
      />
    </label>
  );
}

function RunNumberField({
  Icon,
  label,
  suffix,
  value,
  onChange,
  min,
  max,
  step,
  soon,
}: {
  Icon: typeof Timer;
  label: string;
  suffix: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
  soon?: boolean;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 6,
        padding: 10,
        opacity: soon ? 0.7 : 1,
      }}
    >
      <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 4 }}>
        <Icon size={12} style={{ color: 'var(--ink-2)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
        {soon && <RunSoonPill />}
      </div>
      <div className="row" style={{ gap: 4, alignItems: 'baseline' }}>
        <input
          type="number"
          className="field tabular"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          style={{ flex: 1, fontSize: 12.5 }}
        />
        {suffix && (
          <span className="dim" style={{ fontSize: 11 }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function RunSoonPill() {
  return (
    <span
      style={{
        marginLeft: 'auto',
        padding: '1px 6px',
        borderRadius: 999,
        background: 'var(--amber-soft)',
        color: 'var(--amber)',
        border: '1px solid var(--amber-edge)',
        fontSize: 9,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      soon
    </span>
  );
}
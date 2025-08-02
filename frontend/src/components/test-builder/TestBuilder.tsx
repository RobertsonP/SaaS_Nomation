import { useState, useEffect } from 'react'
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
import { getProjectElements } from '../../lib/api'
import { ElementLibraryPanel } from './ElementLibraryPanel'
import { SelectorSuggestions } from './SelectorSuggestions'
import { SelectorValidator } from './SelectorValidator'
import { SortableTestStep } from './SortableTestStep'
import { DragOverlay } from './DragOverlay'

interface TestStep {
  id: string
  type: 'click' | 'type' | 'wait' | 'assert' | 'hover' | 'scroll' | 'select' | 'clear' | 'doubleclick' | 'rightclick' | 'press' | 'upload' | 'check' | 'uncheck'
  selector: string
  value?: string
  description: string
}

interface TestBuilderProps {
  onSave: (steps: TestStep[]) => void
  onCancel: () => void
  initialSteps?: TestStep[]
  projectId?: string // AI Enhancement: Pass project ID for element library
}

export function TestBuilder({ onSave, onCancel, initialSteps = [], projectId }: TestBuilderProps) {
  // Existing state
  const [steps, setSteps] = useState<TestStep[]>(initialSteps)
  const [showAddStep, setShowAddStep] = useState(false)
  const [editingStep, setEditingStep] = useState<TestStep | null>(null)
  const [newStep, setNewStep] = useState<Partial<TestStep>>({
    type: 'click',
    selector: '',
    value: '',
    description: ''
  })

  // AI Enhancement state
  const [elementLibrary, setElementLibrary] = useState<ProjectElement[]>([])
  const [loadingElements, setLoadingElements] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showElementLibrary, setShowElementLibrary] = useState(false)
  const [enableValidation, setEnableValidation] = useState(true)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [showAiSuggestions, setShowAiSuggestions] = useState(false)
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false)
  
  // NEW: Live Mode state for dynamic element discovery
  const [isLiveMode, setIsLiveMode] = useState(false)
  const [liveBrowserSession, setLiveBrowserSession] = useState<string | null>(null)
  const [liveElements, setLiveElements] = useState<ProjectElement[]>([])
  const [loadingLiveElements, setLoadingLiveElements] = useState(false)

  // Drag and Drop state
  const [activeStep, setActiveStep] = useState<TestStep | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    setSteps(initialSteps)
  }, [initialSteps])

  // AI Enhancement: Load element library when component mounts
  useEffect(() => {
    if (projectId) {
      loadElementLibrary()
    }
  }, [projectId])

  const loadElementLibrary = async () => {
    if (!projectId) return
    
    setLoadingElements(true)
    try {
      const elements = await getProjectElements(projectId)
      setElementLibrary(elements)
      setShowElementLibrary(elements.length > 0)
    } catch (error) {
      console.error('Failed to load element library:', error)
      // Silently fail - element library is optional
    } finally {
      setLoadingElements(false)
    }
  }

  // NEW: Live Mode functions
  const startLiveMode = async () => {
    if (!projectId) return

    setLoadingLiveElements(true)
    try {
      // TODO: Implement API call to create live browser session
      // const response = await fetch('/api/browser/sessions', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ projectId })
      // })
      // const session = await response.json()
      
      // Mock session for now
      const mockSessionToken = `session_${Date.now()}`
      setLiveBrowserSession(mockSessionToken)
      setIsLiveMode(true)
      
      // Load initial elements
      await loadLiveElements()
    } catch (error) {
      console.error('Failed to start live mode:', error)
    } finally {
      setLoadingLiveElements(false)
    }
  }

  const stopLiveMode = async () => {
    if (!liveBrowserSession) return

    try {
      // TODO: Implement API call to close live browser session
      // await fetch(`/api/browser/sessions/${liveBrowserSession}`, {
      //   method: 'DELETE'
      // })
      
      setLiveBrowserSession(null)
      setIsLiveMode(false)
      setLiveElements([])
    } catch (error) {
      console.error('Failed to stop live mode:', error)
    }
  }

  const loadLiveElements = async () => {
    try {
      // TODO: Implement API call to capture live elements
      // const response = await fetch(`/api/browser/sessions/${sessionToken}/elements`)
      // const data = await response.json()
      // setLiveElements(data.elements)
      
      // Mock live elements for now
      const mockLiveElements = [
        {
          id: 'live_1',
          selector: '#dynamic-button',
          elementType: 'button',
          description: 'Dynamic Button (Live)',
          confidence: 0.95,
          attributes: { text: 'Click Me', discoveryState: 'after_login' }
        },
        {
          id: 'live_2', 
          selector: '.modal-close',
          elementType: 'button',
          description: 'Modal Close Button (Live)',
          confidence: 0.9,
          attributes: { text: '×', discoveryState: 'modal' }
        }
      ]
      setLiveElements(mockLiveElements as any)
    } catch (error) {
      console.error('Failed to load live elements:', error)
    }
  }

  const performLiveAction = async (action: { type: string; selector: string; value?: string }) => {
    if (!liveBrowserSession) return

    setLoadingLiveElements(true)
    try {
      // TODO: Implement API call to perform action and capture new elements
      // const response = await fetch(`/api/browser/sessions/${liveBrowserSession}/actions`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(action)
      // })
      // const data = await response.json()
      // setLiveElements(data.elements)
      
      console.log('Performed live action:', action)
      // Mock new elements discovered after action
      await loadLiveElements()
    } catch (error) {
      console.error('Failed to perform live action:', error)
    } finally {
      setLoadingLiveElements(false)
    }
  }

  const stepTypes = [
    // Basic Actions
    { value: 'click', label: 'Click Element', needsValue: false },
    { value: 'doubleclick', label: 'Double Click Element', needsValue: false },
    { value: 'rightclick', label: 'Right Click Element', needsValue: false },
    { value: 'hover', label: 'Hover Over Element', needsValue: false },
    
    // Input Actions
    { value: 'type', label: 'Type Text', needsValue: true },
    { value: 'clear', label: 'Clear Input Field', needsValue: false },
    { value: 'select', label: 'Select Option', needsValue: true },
    { value: 'check', label: 'Check Checkbox', needsValue: false },
    { value: 'uncheck', label: 'Uncheck Checkbox', needsValue: false },
    { value: 'upload', label: 'Upload File', needsValue: true },
    
    // Navigation & Control
    { value: 'scroll', label: 'Scroll', needsValue: true },
    { value: 'press', label: 'Press Key', needsValue: true },
    { value: 'wait', label: 'Wait', needsValue: true },
    
    // Verification
    { value: 'assert', label: 'Assert Text', needsValue: true }
  ]

  // AI Enhancement: Handle element selection from library
  const handleElementSelect = (element: ProjectElement) => {
    setNewStep({
      ...newStep,
      selector: element.selector,
      description: newStep.description || element.description
    })
    
    // Auto-suggest step type based on element type
    if (element.elementType === 'button') {
      setNewStep(prev => ({ ...prev, type: 'click' }))
    } else if (element.elementType === 'input') {
      // Check if it's a checkbox or radio button
      const inputType = element.attributes?.type || '';
      if (inputType === 'checkbox') {
        setNewStep(prev => ({ ...prev, type: 'check' }))
      } else if (inputType === 'radio') {
        setNewStep(prev => ({ ...prev, type: 'click' }))
      } else if (inputType === 'file') {
        setNewStep(prev => ({ ...prev, type: 'upload' }))
      } else if (inputType === 'submit') {
        setNewStep(prev => ({ ...prev, type: 'click' }))
      } else {
        setNewStep(prev => ({ ...prev, type: 'type' }))
      }
    } else if (element.elementType === 'link') {
      setNewStep(prev => ({ ...prev, type: 'click' }))
    } else if (element.elementType === 'form') {
      setNewStep(prev => ({ ...prev, type: 'assert' }))
    }
    
    setShowSuggestions(false)
  }

  // AI Enhancement: Handle suggestion selection
  const handleSuggestionSelect = (selector: string, description?: string) => {
    setNewStep({
      ...newStep,
      selector,
      description: newStep.description || description || ''
    })
    setShowSuggestions(false)
  }

  // Visual Element Picker: Handle element selection

  // AI Suggestion: Generate improved selector alternatives
  const handleAISuggestion = async () => {
    if (!newStep.selector || !projectId) return

    setLoadingAiSuggestions(true)
    setShowAiSuggestions(true)
    
    try {
      // Simulate AI analysis - in a real implementation, this would call an AI service
      const improvements = generateSelectorImprovements(newStep.selector)
      setAiSuggestions(improvements)
    } catch (error) {
      console.error('Failed to get AI suggestions:', error)
      setAiSuggestions(['Failed to generate suggestions'])
    } finally {
      setLoadingAiSuggestions(false)
    }
  }

  // Helper function to generate selector improvements
  const generateSelectorImprovements = (selector: string): string[] => {
    const suggestions: string[] = []
    
    // Add data-testid suggestion
    if (!selector.includes('data-testid')) {
      suggestions.push(`[data-testid="${selector.replace(/[^a-zA-Z0-9]/g, '-')}"]`)
    }
    
    // Add aria-label suggestion
    if (!selector.includes('aria-label')) {
      suggestions.push(`[aria-label*="${selector.split(' ')[0]}"]`)
    }
    
    // Add role-based suggestion
    if (!selector.includes('role=')) {
      suggestions.push(`[role="button"]:has-text("${selector}")`)
    }
    
    // Add more specific class-based suggestion
    if (selector.includes('.')) {
      const classNames = selector.match(/\.[a-zA-Z0-9_-]+/g)
      if (classNames && classNames.length > 0) {
        suggestions.push(`${classNames.join('')}:visible`)
      }
    }
    
    // Add text-based suggestion
    if (!selector.includes(':has-text')) {
      suggestions.push(`:has-text("${selector}")`)
    }
    
    return suggestions.slice(0, 4) // Limit to 4 suggestions
  }

  const addStep = () => {
    if (!newStep.selector || !newStep.description) return

    const step: TestStep = {
      id: Date.now().toString(),
      type: newStep.type as TestStep['type'],
      selector: newStep.selector,
      value: newStep.value,
      description: newStep.description
    }

    setSteps([...steps, step])
    setNewStep({
      type: 'click',
      selector: '',
      value: '',
      description: ''
    })
    setShowAddStep(false)
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

  const updateStep = () => {
    if (!editingStep || !newStep.selector || !newStep.description) return

    const updatedStep: TestStep = {
      id: editingStep.id,
      type: newStep.type as TestStep['type'],
      selector: newStep.selector,
      value: newStep.value,
      description: newStep.description
    }

    setSteps(steps.map(step => step.id === editingStep.id ? updatedStep : step))
    setEditingStep(null)
    setNewStep({
      type: 'click',
      selector: '',
      value: '',
      description: ''
    })
    setShowAddStep(false)
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

  const removeStep = (id: string) => {
    setSteps(steps.filter(step => step.id !== id))
  }

  // Drag and Drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const activeStep = steps.find(step => step.id === active.id)
    if (activeStep) {
      setActiveStep(activeStep)
      setActiveIndex(steps.findIndex(step => step.id === active.id))
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
    setActiveIndex(-1)
  }

  const selectedStepType = stepTypes.find(type => type.value === newStep.type)

  return (
    <div className="bg-white rounded-lg shadow border">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Test Builder</h2>
            <p className="text-gray-600 mt-1">Build your automated test step by step</p>
          </div>
          
          {/* AI Enhancement: Controls */}
          <div className="flex items-center space-x-3">
            {/* NEW: Live Mode Toggle */}
            {projectId && (
              <button
                onClick={isLiveMode ? stopLiveMode : startLiveMode}
                disabled={loadingLiveElements}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  isLiveMode 
                    ? 'bg-orange-600 text-white hover:bg-orange-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } ${loadingLiveElements ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isLiveMode ? 'Stop live browser session' : 'Start live browser session for real-time element discovery'}
              >
                {loadingLiveElements ? (
                  <>
                    <svg className="animate-spin inline w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </>
                ) : isLiveMode ? (
                  '🔴 Stop Live'
                ) : (
                  '🟢 Live Mode'
                )}
              </button>
            )}

            {/* Validation Toggle */}
            <button
              onClick={() => setEnableValidation(!enableValidation)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                enableValidation 
                  ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Toggle real-time selector validation"
            >
              {enableValidation ? '✓ Validation' : 'Validation'}
            </button>

            {/* Element Library Toggle */}
            {(elementLibrary.length > 0 || liveElements.length > 0) && (
              <button
                onClick={() => setShowElementLibrary(!showElementLibrary)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  showElementLibrary 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={`${showElementLibrary ? 'Hide' : 'Show'} element library`}
              >
                {showElementLibrary ? '🤖 Hide Elements' : `🤖 Show Elements ${isLiveMode ? '(Live)' : ''}`}
              </button>
            )}


            {(loadingElements || loadingLiveElements) && (
              <div className="flex items-center text-sm text-gray-500">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {loadingLiveElements ? 'Loading live elements...' : 'Loading elements...'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main Test Builder Column */}
          <div className={`${showElementLibrary ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            {/* Steps List with Drag and Drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-4 mb-6">
                {steps.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No test steps yet. Add your first step below.
                  </div>
                ) : (
                  <SortableContext items={steps} strategy={verticalListSortingStrategy}>
                    {steps.map((step, index) => (
                      <SortableTestStep
                        key={step.id}
                        step={step}
                        index={index}
                        onRemove={() => removeStep(step.id)}
                        onEdit={() => editStep(step)}
                      />
                    ))}
                  </SortableContext>
                )}
              </div>
              <DragOverlay activeStep={activeStep} activeIndex={activeIndex} />
            </DndContext>

        {/* Add Step Form */}
        {showAddStep ? (
          <div className="border rounded-lg p-4 bg-blue-50">
            <h3 className="text-lg font-medium mb-4">
              {editingStep ? `Edit Step: ${editingStep.description}` : 'Add New Step'}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Step Type
                </label>
                <select
                  value={newStep.type}
                  onChange={(e) => setNewStep({ ...newStep, type: e.target.value as TestStep['type'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {stepTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Enhanced CSS Selector Input with AI Suggestions */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CSS Selector
                  {elementLibrary.length > 0 && (
                    <span className="ml-2 text-xs text-blue-600">
                      (AI suggestions available)
                    </span>
                  )}
                </label>
                <div className="flex">
                  <input
                    type="text"
                    value={newStep.selector}
                    onChange={(e) => {
                      setNewStep({ ...newStep, selector: e.target.value })
                      setShowSuggestions(true)
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., #submit-button, .login-form input[type=email]"
                  />
                  <button
                    type="button"
                    onClick={handleAISuggestion}
                    className="bg-purple-600 text-white px-3 py-2 rounded-r-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-600"
                    title="Get AI-improved selector suggestions"
                    disabled={!newStep.selector || newStep.selector.length < 3}
                  >
                    🤖 AI
                  </button>
                </div>
                
                {/* AI Suggestions Dropdown */}
                <SelectorSuggestions
                  elements={isLiveMode ? liveElements : elementLibrary}
                  currentSelector={newStep.selector || ''}
                  onSelectSuggestion={handleSuggestionSelect}
                  isVisible={showSuggestions && (elementLibrary.length > 0 || liveElements.length > 0)}
                />

                {/* AI Suggestions Display */}
                {showAiSuggestions && (
                  <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-purple-900">AI Improved Selectors</h4>
                      <button
                        onClick={() => setShowAiSuggestions(false)}
                        className="text-purple-600 hover:text-purple-800 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                    {loadingAiSuggestions ? (
                      <div className="flex items-center text-sm text-purple-600">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating AI suggestions...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {aiSuggestions.map((suggestion, index) => (
                          <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                            <code className="text-sm text-gray-700 flex-1 font-mono">{suggestion}</code>
                            <button
                              onClick={() => {
                                setNewStep({ ...newStep, selector: suggestion })
                                setShowAiSuggestions(false)
                              }}
                              className="ml-2 bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700"
                            >
                              Use
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Real-time Validation */}
                {projectId && enableValidation && (
                  <SelectorValidator
                    projectId={projectId}
                    selector={newStep.selector || ''}
                    isEnabled={enableValidation}
                  />
                )}
              </div>

              {selectedStepType?.needsValue && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {newStep.type === 'type' ? 'Text to Type' : 
                     newStep.type === 'wait' ? 'Wait Time (ms)' : 
                     newStep.type === 'assert' ? 'Expected Text' :
                     newStep.type === 'select' ? 'Option to Select' :
                     newStep.type === 'upload' ? 'File Path' :
                     newStep.type === 'scroll' ? 'Scroll Direction (up/down/left/right)' :
                     newStep.type === 'press' ? 'Key to Press' :
                     'Value'}
                  </label>
                  <input
                    type="text"
                    value={newStep.value}
                    onChange={(e) => setNewStep({ ...newStep, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={
                      newStep.type === 'type' ? 'Enter text to type' :
                      newStep.type === 'wait' ? '1000' :
                      newStep.type === 'assert' ? 'Expected text content' :
                      newStep.type === 'select' ? 'Option value or text' :
                      newStep.type === 'upload' ? '/path/to/file.pdf' :
                      newStep.type === 'scroll' ? 'down' :
                      newStep.type === 'press' ? 'Enter' :
                      'Enter value'
                    }
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newStep.description}
                  onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe what this step does"
                />
              </div>
            </div>

            <div className="flex space-x-4 mt-4">
              <button
                onClick={editingStep ? updateStep : addStep}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                {editingStep ? 'Update Step' : 'Add Step'}
              </button>
              <button
                onClick={editingStep ? cancelEdit : () => setShowAddStep(false)}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddStep(true)}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-600 hover:border-blue-400 hover:text-blue-600"
          >
            + Add New Step
          </button>
        )}

            {/* Actions */}
            <div className="flex space-x-4 mt-6 pt-6 border-t">
              <button
                onClick={() => onSave(steps)}
                disabled={steps.length === 0}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Save Test
              </button>
              <button
                onClick={onCancel}
                className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* AI Enhancement: Element Library Sidebar */}
          {showElementLibrary && (
            <div className="lg:col-span-1">
              <ElementLibraryPanel
                elements={isLiveMode ? liveElements : elementLibrary}
                onSelectElement={handleElementSelect}
                isLoading={loadingElements || loadingLiveElements}
                isLiveMode={isLiveMode}
                onPerformAction={isLiveMode ? performLiveAction : undefined}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
import { useState } from 'react'
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
}

export function TestBuilderPanel({ 
  selectedElement, 
  onClearSelection,
  className = '',
  onSave,
  onCancel,
  initialSteps = []
}: TestBuilderPanelProps) {
  const [steps, setSteps] = useState<TestStep[]>(initialSteps)
  const [showAddStep, setShowAddStep] = useState(false)
  const [editingStep, setEditingStep] = useState<TestStep | null>(null)
  const [newStep, setNewStep] = useState<Partial<TestStep>>({
    type: 'click',
    selector: '',
    value: '',
    description: ''
  })
  const [activeStep, setActiveStep] = useState<TestStep | null>(null)

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

      {/* Content - Properly Constrained for Scrollability */}
      <div className="flex-1 flex flex-col min-h-0">
        {selectedElement ? (
          <>
            {/* Compact Element Card with Action Controls - Fixed Height */}
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
                      setNewStep({
                        ...newStep,
                        selector: selectedElement.selector,
                        description: `${selectedStepType?.label} on ${selectedElement.description}`
                      });
                      addStep();
                    }}
                    disabled={selectedStepType?.needsValue && !newStep.value}
                    className="w-full px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Add to Test
                  </button>
                </div>
              </div>
            </div>

            {/* Test Steps Header - Fixed Height */}
            <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-900">Test Steps ({steps.length})</h3>
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
                      Select an element and choose an action to build your test
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-400 text-4xl mb-4">🎯</div>
              <div className="text-sm text-gray-500 mb-2">No element selected</div>
              <div className="text-xs text-gray-400">
                Select an element from the library to start building your test
              </div>
            </div>
          </div>
        )}

        {/* Save/Cancel Buttons - Always Visible at Bottom */}
        <div className="flex-shrink-0 border-t border-gray-200 p-4">
          <div className="flex space-x-3">
            <button
              onClick={() => onSave?.(steps)}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              {steps.length > 0 
                ? `Save Test (${steps.length} step${steps.length !== 1 ? 's' : ''})` 
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
    </div>
  )
}
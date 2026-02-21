import { useState, useEffect } from 'react'
import { ProjectElement } from '../../types/element.types'
import { TestStep } from '../../types/test.types'
import { getProjectElements } from '../../lib/api'
import { ElementLibraryPanel } from './ElementLibraryPanel'
import { TestBuilderPanel } from './TestBuilderPanel'
import { CellStepData } from '../elements/CellSelectorPopover'

interface TestBuilderProps {
  onSave: (steps: TestStep[]) => void
  onCancel: () => void
  initialSteps?: TestStep[]
  projectId?: string // AI Enhancement: Pass project ID for element library
  testId?: string // For localStorage persistence
  onElementsUpdated?: () => void // Callback when new elements are discovered
  startingUrl?: string // Test's configured starting URL
  setShowLivePicker: (show: boolean) => void // NEW PROP
}

export function TestBuilder({ onSave, onCancel, initialSteps = [], projectId, testId, onElementsUpdated, startingUrl, setShowLivePicker }: TestBuilderProps) {
  // Simplified state for layout component
  const [elementLibrary, setElementLibrary] = useState<ProjectElement[]>([])
  const [loadingElements, setLoadingElements] = useState(false)
  const [selectedElement, setSelectedElement] = useState<ProjectElement | null>(null)
  const [pendingStep, setPendingStep] = useState<TestStep | null>(null)

  // Enhanced element library filtering state
  const [selectedElementType, setSelectedElementType] = useState<string>('all')
  const [selectedUrl, setSelectedUrl] = useState<string>('all')

  // Load element library when component mounts
  useEffect(() => {
    if (projectId) {
      loadElementLibrary()
    }
  }, [projectId])

  const loadElementLibrary = async () => {
    if (!projectId) return
    
    try {
      setLoadingElements(true)
      const elements = await getProjectElements(projectId)
      setElementLibrary(elements)
    } catch (error) {
      console.error('Failed to load element library:', error)
    } finally {
      setLoadingElements(false)
    }
  }

  // AI Enhancement: Handle element selection from library
  const handleElementSelect = (element: ProjectElement) => {
    setSelectedElement(element)
  }

  // Handle new elements discovered from hunting
  const handleHuntNewElements = (newElements: ProjectElement[]) => {
    // Add new elements to the current library
    setElementLibrary(prev => [...prev, ...newElements])
    // Notify parent component to refresh if needed
    onElementsUpdated?.()
  }

  // Handle elements added from live element picker
  const handleElementsAdded = (newElements: ProjectElement[]) => {
    // Add new elements to the current library
    setElementLibrary(prev => [...prev, ...newElements])
    // Notify parent component to refresh if needed
    onElementsUpdated?.()
  }

  // Handle cell/table step addition from explorer
  const handleAddStep = (stepData: CellStepData) => {
    const step: TestStep = {
      id: Math.random().toString(36).substr(2, 9),
      type: stepData.type as TestStep['type'],
      selector: stepData.selector,
      value: stepData.value || undefined,
      description: stepData.description,
    }
    setPendingStep(step)
  }

  return (
    <div className="bg-white h-full flex flex-col">
      {/* OPTIMIZED LAYOUT: 60% element library + 40% test steps */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR: Element Library (60% - EXPANDED) */}
        <div className="w-3/5 border-r border-gray-200">
          <ElementLibraryPanel
            elements={elementLibrary}
            onSelectElement={handleElementSelect}
            onAddStep={handleAddStep}
            selectedElementType={selectedElementType}
            selectedUrl={selectedUrl}
            onElementTypeChange={setSelectedElementType}
            onUrlChange={setSelectedUrl}
            previewMode="auto"
            showQuality={true}
            compact={false}
            isLoading={loadingElements}
            setShowLivePicker={setShowLivePicker}
          />
        </div>

        {/* RIGHT PANEL: Test Builder (40% - REDUCED) */}
        <div className="w-2/5">
          <TestBuilderPanel
            selectedElement={selectedElement || undefined}
            onClearSelection={() => setSelectedElement(null)}
            onSave={onSave}
            onCancel={onCancel}
            initialSteps={initialSteps}
            testId={testId}
            projectId={projectId}
            onHuntNewElements={handleHuntNewElements}
            startingUrl={startingUrl}
            pendingStep={pendingStep}
            onPendingStepConsumed={() => setPendingStep(null)}
            className="h-full"
          />
        </div>
      </div>
    </div>
  )
}
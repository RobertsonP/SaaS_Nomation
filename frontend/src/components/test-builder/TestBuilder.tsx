import { useState } from 'react'
import { ProjectElement } from '../../types/element.types'
import { TestStep } from '../../types/test.types'
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
  const [selectedElement, setSelectedElement] = useState<ProjectElement | null>(null)
  const [pendingStep, setPendingStep] = useState<TestStep | null>(null)

  // Enhanced element library filtering state
  const [selectedElementType, setSelectedElementType] = useState<string>('all')
  const [selectedUrl, setSelectedUrl] = useState<string>('all')

  // Key to force ElementLibraryPanel to re-fetch after new elements are added
  const [elementsRefreshKey, setElementsRefreshKey] = useState(0)

  // AI Enhancement: Handle element selection from library
  const handleElementSelect = (element: ProjectElement) => {
    setSelectedElement(element)
  }

  // Handle new elements discovered from hunting
  const handleHuntNewElements = (_newElements: ProjectElement[]) => {
    // Trigger a refresh of the paginated element library
    setElementsRefreshKey(prev => prev + 1)
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
    <div className="bg-white dark:bg-gray-800 h-full flex flex-col">
      {/* OPTIMIZED LAYOUT: 60% element library + 40% test steps */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR: Element Library (60% - EXPANDED) */}
        <div className="w-3/5 border-r border-gray-200 dark:border-gray-700">
          <ElementLibraryPanel
            key={elementsRefreshKey}
            projectId={projectId}
            onSelectElement={handleElementSelect}
            onAddStep={handleAddStep}
            selectedElementType={selectedElementType}
            selectedUrl={selectedUrl}
            onElementTypeChange={setSelectedElementType}
            onUrlChange={setSelectedUrl}
            previewMode="auto"
            showQuality={true}
            compact={false}
            isLoading={false}
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
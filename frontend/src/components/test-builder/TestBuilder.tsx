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
    <div
      className="col"
      style={{
        background: 'var(--paper)',
        height: '100%',
      }}
    >
      {/* Layout matches pages.jsx:15 — fixed library sidebar (320px, slightly
          wider than the design's 280px to keep our richer cards readable),
          flexible test-steps panel on the right. */}
      <div style={{ display: 'flex', flexDirection: 'row', flex: 1, overflow: 'hidden', minHeight: 0, alignItems: 'stretch' }}>
        <div
          style={{
            width: 320,
            flexShrink: 0,
            borderRight: '1px solid var(--hair)',
            background: 'var(--paper)',
            overflow: 'hidden',
          }}
        >
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

        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
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
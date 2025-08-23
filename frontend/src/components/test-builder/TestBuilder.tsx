import { useState, useEffect } from 'react'
import { ProjectElement } from '../../types/element.types'
import { getProjectElements } from '../../lib/api'
import { ElementLibrarySidebar } from './ElementLibrarySidebar'
import { TestBuilderPanel } from './TestBuilderPanel'

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
  testId?: string // For localStorage persistence
  onElementsUpdated?: () => void // Callback when new elements are discovered
}

export function TestBuilder({ onSave, onCancel, initialSteps = [], projectId, testId, onElementsUpdated }: TestBuilderProps) {
  // Simplified state for layout component
  const [elementLibrary, setElementLibrary] = useState<ProjectElement[]>([])
  const [loadingElements, setLoadingElements] = useState(false)
  const [selectedElement, setSelectedElement] = useState<ProjectElement | null>(null)
  const [enableValidation, setEnableValidation] = useState(true)

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

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Ultra-Compact Controls */}
      <div className="px-3 py-1 border-b border-gray-200 flex justify-end">
        <div className="flex items-center space-x-2">
          {/* Ultra-Compact Validation Toggle */}
          <button
            onClick={() => setEnableValidation(!enableValidation)}
            className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
              enableValidation 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="Toggle real-time selector validation"
          >
            {enableValidation ? '✓' : '○'}
          </button>

          {loadingElements && (
            <div className="flex items-center text-xs text-gray-500">
              <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading...
            </div>
          )}
        </div>
      </div>

      {/* CONTENTFUL-STYLE LAYOUT: 40% left sidebar + 60% right panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR: Element Library (40%) */}
        <div className="w-2/5 border-r border-gray-200">
          <ElementLibrarySidebar
            elements={elementLibrary}
            onSelectElement={handleElementSelect}
            onElementsAdded={handleElementsAdded}
            projectId={projectId}
            isLoading={loadingElements}
            className="h-full"
          />
        </div>

        {/* RIGHT PANEL: Test Builder (60%) */}
        <div className="flex-1">
          <TestBuilderPanel
            selectedElement={selectedElement || undefined}
            onClearSelection={() => setSelectedElement(null)}
            onSave={onSave}
            onCancel={onCancel}
            initialSteps={initialSteps}
            testId={testId}
            projectId={projectId}
            onHuntNewElements={handleHuntNewElements}
            className="h-full"
          />
        </div>
      </div>
    </div>
  )
}
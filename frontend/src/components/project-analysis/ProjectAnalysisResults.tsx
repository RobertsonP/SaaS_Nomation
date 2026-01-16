import { useState } from 'react'

interface ProjectAnalysis {
  framework: 'react' | 'vue' | 'angular' | 'mixed' | 'unknown'
  components: Array<{
    name: string
    filePath: string
    elements: Array<{
      type: string
      selector: string
      text?: string
      placeholder?: string
      action?: string
      description: string
    }>
  }>
  totalFiles: number
  processedFiles: number
  errors: string[]
}

interface ProjectAnalysisResultsProps {
  analysis: ProjectAnalysis
  onCreateTests: (selectedElements: any[]) => void
  onStartOver: () => void
}

export function ProjectAnalysisResults({ analysis, onCreateTests, onStartOver }: ProjectAnalysisResultsProps) {
  const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set())
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set())
  const [showAllElements, setShowAllElements] = useState(false)

  const getFrameworkIcon = (framework: string) => {
    switch (framework) {
      case 'react': return '⚛️'
      case 'vue': return '💚'
      case 'angular': return '🅰️'
      case 'mixed': return '🔄'
      default: return '❓'
    }
  }

  const getFrameworkColor = (framework: string) => {
    switch (framework) {
      case 'react': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'vue': return 'text-green-600 bg-green-50 border-green-200'
      case 'angular': return 'text-red-600 bg-red-50 border-red-200'
      case 'mixed': return 'text-purple-600 bg-purple-50 border-purple-200'
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }
  }

  const getElementTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'button': return '🔲'
      case 'input': return '📝'
      case 'form': return '📋'
      case 'a': case 'link': return '🔗'
      case 'div': return '📦'
      case 'select': return '📋'
      case 'textarea': return '📄'
      default: return '🔘'
    }
  }

  const toggleElement = (componentName: string, elementIndex: number) => {
    const elementKey = `${componentName}-${elementIndex}`
    const newSelected = new Set(selectedElements)
    
    if (newSelected.has(elementKey)) {
      newSelected.delete(elementKey)
    } else {
      newSelected.add(elementKey)
    }
    
    setSelectedElements(newSelected)
  }

  const toggleComponent = (componentName: string) => {
    const newExpanded = new Set(expandedComponents)
    
    if (newExpanded.has(componentName)) {
      newExpanded.delete(componentName)
    } else {
      newExpanded.add(componentName)
    }
    
    setExpandedComponents(newExpanded)
  }

  const selectAllElements = () => {
    const allElements = new Set<string>()
    analysis.components.forEach(component => {
      component.elements.forEach((element, index) => {
        allElements.add(`${component.name}-${index}`)
      })
    })
    setSelectedElements(allElements)
  }

  const clearSelection = () => {
    setSelectedElements(new Set())
  }

  const handleCreateTests = () => {
    const selectedElementsData: any[] = []
    
    analysis.components.forEach(component => {
      component.elements.forEach((element, index) => {
        const elementKey = `${component.name}-${index}`
        if (selectedElements.has(elementKey)) {
          selectedElementsData.push({
            ...element,
            componentName: component.name,
            filePath: component.filePath
          })
        }
      })
    })
    
    onCreateTests(selectedElementsData)
  }

  const totalElements = analysis.components.reduce((sum, comp) => sum + comp.elements.length, 0)
  const componentsWithElements = analysis.components.filter(comp => comp.elements.length > 0)
  const displayComponents = showAllElements ? analysis.components : componentsWithElements

  return (
    <div className="space-y-6">
      {/* Analysis Summary Header */}
      <div className={`border rounded-lg p-4 ${getFrameworkColor(analysis.framework)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{getFrameworkIcon(analysis.framework)}</span>
            <div>
              <h2 className="text-lg font-semibold">
                {analysis.framework.toUpperCase()} Project Analysis Complete!
              </h2>
              <p className="text-sm opacity-80">
                🚀 First tool EVER to analyze local development projects!
              </p>
            </div>
          </div>
          <button
            onClick={onStartOver}
            className="px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Upload Different Project
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{analysis.processedFiles}</div>
          <div className="text-sm text-gray-600">Files Analyzed</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{componentsWithElements.length}</div>
          <div className="text-sm text-gray-600">Components Found</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{totalElements}</div>
          <div className="text-sm text-gray-600">UI Elements</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{selectedElements.size}</div>
          <div className="text-sm text-gray-600">Selected</div>
        </div>
      </div>

      {/* Selection Controls */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-semibold">Select Elements for Testing</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowAllElements(!showAllElements)}
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {showAllElements ? 'Hide Empty Components' : 'Show All Components'}
            </button>
            <button
              onClick={selectAllElements}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Select All
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Clear Selection
            </button>
          </div>
        </div>
      </div>

      {/* Components and Elements List */}
      <div className="space-y-4">
        {displayComponents.length === 0 ? (
          <div className="bg-white border rounded-lg p-8 text-center">
            <div className="text-4xl mb-4">📁</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Interactive Elements Found</h3>
            <p className="text-gray-600 mb-4">
              We couldn't find any interactive UI elements in your {analysis.framework} project.
            </p>
            <div className="text-sm text-gray-500 text-left max-w-md mx-auto space-y-2">
              <p><strong>Looking for:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Buttons with click handlers</li>
                <li>Form inputs and controls</li>
                <li>Links and navigation elements</li>
                <li>Interactive divs and components</li>
              </ul>
            </div>
          </div>
        ) : (
          displayComponents.map((component) => (
            <div key={component.name} className="bg-white border rounded-lg">
              <div
                className="p-4 border-b cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => toggleComponent(component.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">
                      {expandedComponents.has(component.name) ? '📂' : '📁'}
                    </span>
                    <div>
                      <h4 className="font-medium text-gray-900">{component.name}</h4>
                      <p className="text-sm text-gray-500">{component.filePath}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {component.elements.length} element{component.elements.length !== 1 ? 's' : ''}
                    </span>
                    <span className="transform transition-transform">
                      {expandedComponents.has(component.name) ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
              </div>

              {expandedComponents.has(component.name) && (
                <div className="p-4 space-y-3">
                  {component.elements.map((element, index) => {
                    const elementKey = `${component.name}-${index}`
                    const isSelected = selectedElements.has(elementKey)
                    
                    return (
                      <div
                        key={index}
                        className={`border rounded p-3 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => toggleElement(component.name, index)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <span className="text-lg">
                              {getElementTypeIcon(element.type)}
                            </span>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {element.description}
                              </p>
                              
                              <div className="mt-1 space-y-1">
                                <div className="text-xs text-gray-600">
                                  <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                                    Type: {element.type}
                                  </span>
                                </div>
                                
                                <div className="text-xs text-gray-600">
                                  <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                                    Selector: {element.selector}
                                  </span>
                                </div>
                                
                                {element.action && (
                                  <div className="text-xs text-gray-600">
                                    <span className="font-mono bg-blue-100 px-1.5 py-0.5 rounded">
                                      Action: {element.action}
                                    </span>
                                  </div>
                                )}
                                
                                {element.text && (
                                  <div className="text-xs text-gray-600">
                                    <span className="font-mono bg-green-100 px-1.5 py-0.5 rounded">
                                      Text: "{element.text}"
                                    </span>
                                  </div>
                                )}
                                
                                {element.placeholder && (
                                  <div className="text-xs text-gray-600">
                                    <span className="font-mono bg-yellow-100 px-1.5 py-0.5 rounded">
                                      Placeholder: "{element.placeholder}"
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-500' 
                              : 'border-gray-300'
                          }`}>
                            {isSelected && <span className="text-white text-xs">✓</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Errors Section */}
      {analysis.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-800 mb-2">Processing Errors</h4>
          <div className="text-sm text-red-700 space-y-1">
            {analysis.errors.map((error, index) => (
              <p key={index}>• {error}</p>
            ))}
          </div>
        </div>
      )}

      {/* Create Tests Button */}
      {totalElements > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Ready to Create Tests</h4>
              <p className="text-sm text-gray-600">
                Selected {selectedElements.size} element{selectedElements.size !== 1 ? 's' : ''} from your {analysis.framework} project
              </p>
            </div>
            <button
              onClick={handleCreateTests}
              disabled={selectedElements.size === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all hover:scale-105"
            >
              🚀 Create Tests ({selectedElements.size})
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
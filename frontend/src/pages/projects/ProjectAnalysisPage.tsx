import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { FolderUploadZone } from '../../components/project-upload/FolderUploadZone'
import { ProjectAnalysisResults } from '../../components/project-analysis/ProjectAnalysisResults'
import { OnboardingFlow, useOnboarding } from '../../components/onboarding/OnboardingFlow'
import { ContextualHelp, useContextualHelp } from '../../components/onboarding/ContextualHelp'
import { projectsAPI } from '../../lib/api'
import { useNotification } from '../../contexts/NotificationContext'
import { useAnalytics } from '../../lib/analytics'

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

export function ProjectAnalysisPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { showSuccess, showError } = useNotification()
  const { trackProjectUpload, trackCompetitiveFeature, trackFeatureUsage, trackError } = useAnalytics()
  const { 
    isOnboardingVisible, 
    currentStep, 
    completeOnboarding, 
    dismissOnboarding, 
    setCurrentStep 
  } = useOnboarding()
  const { setCurrentPage, isHelpEnabled } = useContextualHelp()
  
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null)
  const [isCreatingElements, setIsCreatingElements] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // NEW: Handle folder upload with backend integration
  const handleFolderUpload = async (files: any[]) => {
    setUploadedFiles(files)
    console.log(`Received ${files.length} files for analysis`)
    
    if (!projectId) {
      showError('Error', 'No project ID found')
      return
    }

    try {
      setIsAnalyzing(true)
      
      // Use server-side analysis to analyze the folder and create elements
      const response = await projectsAPI.analyzeProjectFolder(files)
      
      // Track successful upload
      trackProjectUpload(
        response.analysis.framework, 
        response.analysis.statistics.totalFiles,
        response.analysis.elements.length
      )
      
      trackCompetitiveFeature('local_development')
      trackCompetitiveFeature('source_analysis')
      
      // If elements were found, add them to the current project
      if (response.analysis.elements.length > 0) {
        await projectsAPI.createElements(projectId, response.analysis.elements.map((element: any) => ({
          selector: element.selector,
          elementType: element.elementType,
          description: element.description,
          attributes: element.attributes,
          confidence: element.confidence,
          source: 'folder-upload-analysis'
        })))
      }
      
      // Advance onboarding to selection step
      if (currentStep === 'upload' || currentStep === 'analysis') {
        setCurrentStep('selection')
        setCurrentPage('selection')
      }
      
      showSuccess(
        'Folder Analysis Complete!', 
        `Successfully analyzed ${response.analysis.statistics.totalFiles} files and found ${response.analysis.elements.length} UI elements in your ${response.analysis.framework} project.`
      )
      
      // Set analysis results for display
      const analysisResult: ProjectAnalysis = {
        framework: response.analysis.framework as any,
        components: response.analysis.elements.map((element: any) => ({
          name: element.attributes.sourceFile || 'Component',
          filePath: element.attributes.sourceFile || '',
          elements: [{
            type: element.elementType,
            selector: element.selector,
            description: element.description,
            text: element.attributes.text,
            placeholder: element.attributes.placeholder,
            action: 'interact'
          }]
        })),
        totalFiles: response.analysis.statistics.totalFiles,
        processedFiles: response.analysis.statistics.totalFiles,
        errors: []
      }
      
      setAnalysis(analysisResult)
      
    } catch (error: any) {
      console.error('Failed to analyze folder:', error)
      trackError('folder_upload_failed', error?.response?.data || error?.message || 'Unknown error')
      
      // ENTERPRISE ERROR HANDLING - Handle large projects and various error types
      if (error?.response?.status === 413) {
        const totalSize = files.reduce((sum: number, f: any) => sum + f.size, 0);
        const sizeMB = Math.round(totalSize / (1024 * 1024));
        const fileCount = files.length;
        
        showError(
          'Enterprise Project Too Large', 
          `Your project (${sizeMB}MB, ${fileCount} files) exceeds current processing limits.
           
           This could be a:
           • Large Django project with media files
           • Enterprise C#/.NET solution  
           • Java Spring monolith application
           • PHP Laravel with extensive assets
           • React/Angular with large dependencies
           • Any enterprise-scale application
           
           Contact support for enterprise processing solutions.`
        )
      } else if (error?.response?.status === 408 || error?.code === 'TIMEOUT' || error?.message?.includes('timeout')) {
        const fileCount = files.length;
        showError(
          'Enterprise Analysis Timeout', 
          `Analysis timed out for your ${fileCount}-file project. Large enterprise projects may take up to 15 minutes to process.
           
           Please try again. If the issue persists, contact support for high-performance processing options.`
        )
      } else if (error?.response?.status === 507 || error?.message?.includes('memory')) {
        const totalSize = files.reduce((sum: number, f: any) => sum + f.size, 0);
        const sizeMB = Math.round(totalSize / (1024 * 1024));
        
        showError(
          'Enterprise Memory Limit', 
          `Your project (${sizeMB}MB) exceeded memory limits during analysis.
           
           Contact support for high-memory enterprise processing solutions.`
        )
      } else {
        showError(
          'Analysis Failed', 
          error?.response?.data?.message || error?.message || 
          'Failed to analyze your project folder. Please ensure you\'ve uploaded a valid project with supported file types.'
        )
      }
    } finally {
      setIsAnalyzing(false)
    }
  }


  const handleCreateTests = async (selectedElements: any[]) => {
    if (!projectId || selectedElements.length === 0) return
    
    setIsCreatingElements(true)
    
    try {
      // Transform selected elements into ProjectElement format
      const elementsToCreate = selectedElements.map(element => ({
        selector: element.selector,
        elementType: element.type,
        description: element.description,
        attributes: {
          text: element.text,
          placeholder: element.placeholder,
          action: element.action,
          componentName: element.componentName,
          filePath: element.filePath
        },
        confidence: 0.95, // High confidence since extracted from source code
        category: 'local-analysis',
        source: 'project-upload'
      }))

      // Create elements via API
      const startTime = performance.now()
      await projectsAPI.createElements(projectId, elementsToCreate)
      const duration = performance.now() - startTime
      
      // Track successful element creation
      trackFeatureUsage('create_elements_from_upload', {
        element_count: selectedElements.length,
        framework: analysis?.framework,
        duration_ms: Math.round(duration)
      })
      
      showSuccess(
        'Elements Created!',
        `Successfully added ${selectedElements.length} elements to your project library from source code analysis.`
      )
      
      // Advance onboarding to testing step and complete
      if (currentStep === 'selection') {
        setCurrentStep('testing')
        setCurrentPage('testing')
        setTimeout(() => {
          completeOnboarding()
        }, 1000)
      }
      
      // Navigate to test builder
      navigate(`/projects/${projectId}/tests/builder`)
      
    } catch (error: any) {
      console.error('Failed to create elements:', error)
      
      // Track error
      trackError('create_elements_failed', error?.message || 'Unknown error')
      
      showError(
        'Creation Failed', 
        'Failed to create elements from your project analysis. Please try again.'
      )
    } finally {
      setIsCreatingElements(false)
    }
  }

  const handleStartOver = () => {
    setAnalysis(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center space-x-4">
              <Link 
                to={`/projects/${projectId}`} 
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                ← Back to Project
              </Link>
              <div className="w-px h-6 bg-gray-300" />
              <h1 className="text-2xl font-bold text-gray-900">
                🚀 Project Analysis
              </h1>
              <div className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
                REVOLUTIONARY FEATURE
              </div>
            </div>
            <p className="text-gray-600 text-sm mt-2">
              Upload your project folder to automatically extract testable UI elements - supports 30+ languages and frameworks
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!analysis ? (
          <div className="space-y-8">
            {/* Revolutionary Feature Banner */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-white text-blue-600 px-3 py-1 rounded-bl-lg text-xs font-bold">
                WORLD FIRST
              </div>
              <div className="flex items-start space-x-4">
                <div className="text-4xl animate-pulse-soft">🚀</div>
                <div>
                  <h2 className="text-xl font-bold mb-2">Revolutionary Local Development Testing</h2>
                  <p className="text-sm opacity-90 mb-4">
                    Stop waiting for deployments! Test your React, Vue & Angular projects directly from source code.
                  </p>
                  
                  {/* Key Benefits */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-green-300">✅</span>
                      <span><strong>10x Faster:</strong> No deployment delays</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-300">✅</span>
                      <span><strong>Perfect Selectors:</strong> From source code</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-300">✅</span>
                      <span><strong>Zero Setup:</strong> Upload & test in 30s</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-300">✅</span>
                      <span><strong>Developer-First:</strong> Fits your workflow</span>
                    </div>
                  </div>
                  
                  {/* Framework Support */}
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="opacity-75">Supports:</span>
                    <div className="flex space-x-3">
                      <span className="bg-white bg-opacity-20 px-2 py-1 rounded flex items-center space-x-1">
                        <span className="text-lg">⚛️</span>
                        <span>React</span>
                      </span>
                      <span className="bg-white bg-opacity-20 px-2 py-1 rounded flex items-center space-x-1">
                        <span className="text-lg">💚</span>
                        <span>Vue</span>
                      </span>
                      <span className="bg-white bg-opacity-20 px-2 py-1 rounded flex items-center space-x-1">
                        <span className="text-lg">🅰️</span>
                        <span>Angular</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Upload Your Project
                </h3>
                {!uploadedFiles.length && !isAnalyzing ? (
                  <FolderUploadZone
                    onFolderUploaded={handleFolderUpload}
                    className="w-full"
                  />
                ) : isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-semibold text-gray-900">🔍 Analyzing Your Project Folder</h3>
                      <p className="text-gray-600 max-w-md">
                        Our intelligent system is analyzing your {uploadedFiles.length} files to detect framework type, discover UI elements, and extract testable components...
                      </p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-lg">
                      <h4 className="text-sm font-medium text-blue-800 mb-2">🧠 What we're doing:</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Detecting framework (React, Vue, Angular, PHP, Python & more)</li>
                        <li>• Analyzing component structure and UI elements</li>
                        <li>• Generating optimal CSS selectors from source code</li>
                        <li>• Creating project elements for test automation</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">✅</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Folder Processing Complete
                    </h3>
                    <p className="text-gray-600">Check the analysis results below</p>
                  </div>
                )}
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  How It Works
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-3xl mb-2">📁</div>
                    <h4 className="font-medium text-gray-900 mb-1">1. Upload</h4>
                    <p className="text-sm text-gray-600">
                      Drag & drop your project folder containing React, Vue, or Angular components
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl mb-2">🔍</div>
                    <h4 className="font-medium text-gray-900 mb-1">2. Analyze</h4>
                    <p className="text-sm text-gray-600">
                      Our AST parser extracts UI elements, selectors, and interactions from source code
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl mb-2">🎯</div>
                    <h4 className="font-medium text-gray-900 mb-1">3. Select</h4>
                    <p className="text-sm text-gray-600">
                      Choose which elements you want to test with perfect selectors from components
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl mb-2">🚀</div>
                    <h4 className="font-medium text-gray-900 mb-1">4. Test</h4>
                    <p className="text-sm text-gray-600">
                      Generate tests instantly with our visual test builder - no deployment needed
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Competitive Advantage & Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Our Advantages */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-start space-x-3">
                  <div className="text-2xl">🏆</div>
                  <div>
                    <h4 className="font-semibold text-green-800 mb-3">Why We're Different</h4>
                    <div className="space-y-3 text-sm text-green-700">
                      <div className="flex items-start space-x-3">
                        <span className="text-green-600 mt-0.5">🚀</span>
                        <div>
                          <strong>10x Faster Development:</strong>
                          <br />No more waiting for deployments to test changes
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <span className="text-green-600 mt-0.5">🎯</span>
                        <div>
                          <strong>Surgical Precision:</strong>
                          <br />Perfect selectors extracted from your component definitions
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <span className="text-green-600 mt-0.5">🔧</span>
                        <div>
                          <strong>Developer Workflow Integration:</strong>
                          <br />Works with your existing React/Vue/Angular projects
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <span className="text-green-600 mt-0.5">⚡</span>
                        <div>
                          <strong>Instant Results:</strong>
                          <br />Upload → Analyze → Test in under 30 seconds
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">🥊 Us vs Competitors</h4>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-3 gap-2 py-2 border-b border-gray-100">
                    <div className="font-medium text-gray-600">Feature</div>
                    <div className="font-medium text-green-600 text-center">Us</div>
                    <div className="font-medium text-gray-400 text-center">Others</div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 py-2">
                    <div className="text-gray-700">Local Testing</div>
                    <div className="text-center text-green-600">✅ Yes</div>
                    <div className="text-center text-red-500">❌ No</div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 py-2 bg-gray-50">
                    <div className="text-gray-700">Source Code Analysis</div>
                    <div className="text-center text-green-600">✅ Perfect</div>
                    <div className="text-center text-yellow-500">⚠️ Guessed</div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 py-2">
                    <div className="text-gray-700">Setup Time</div>
                    <div className="text-center text-green-600">⚡ 30s</div>
                    <div className="text-center text-red-500">🐌 Hours</div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 py-2 bg-gray-50">
                    <div className="text-gray-700">Framework Support</div>
                    <div className="text-center text-green-600">✅ 3+</div>
                    <div className="text-center text-yellow-500">⚠️ Limited</div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 py-2">
                    <div className="text-gray-700">Result Quality</div>
                    <div className="text-center text-green-600">🏆 Robot Framework</div>
                    <div className="text-center text-gray-400">📝 Basic</div>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                  💡 <strong>Industry First:</strong> We're the only tool that lets you test without deploying!
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ProjectAnalysisResults
            analysis={analysis}
            onCreateTests={handleCreateTests}
            onStartOver={handleStartOver}
          />
        )}
      </div>

      {/* Creating Elements Loading Modal */}
      {isCreatingElements && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="text-center space-y-4">
                <div className="text-4xl">⚙️</div>
                <div>
                  <p className="text-lg font-medium text-gray-900">Creating Test Elements...</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Adding extracted elements to your project library
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Flow */}
      <OnboardingFlow
        currentStep={currentStep}
        isVisible={isOnboardingVisible}
        onDismiss={dismissOnboarding}
        onStepComplete={() => {}}
      />

      {/* Contextual Help */}
      <ContextualHelp
        page={analysis ? 'selection' : 'upload'}
        isVisible={isHelpEnabled && !isOnboardingVisible}
      />
    </div>
  )
}
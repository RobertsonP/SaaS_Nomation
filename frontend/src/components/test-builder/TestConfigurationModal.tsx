import { useState, useEffect } from 'react'
import { Loader2, Pencil, Save, Settings, X } from 'lucide-react'

interface ProjectUrl {
  id: string
  url: string
  title?: string
  description?: string
}

interface Project {
  id: string
  name: string
  urls: ProjectUrl[]
}

interface TestConfigurationModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (config: {
    name: string
    description: string
    startingUrl: string
  }) => void
  project: Project | null
  initialConfig?: {
    name: string
    description: string
    startingUrl: string
  }
  isEdit?: boolean
}

export function TestConfigurationModal({
  isOpen,
  onClose,
  onSave,
  project,
  initialConfig,
  isEdit = false
}: TestConfigurationModalProps) {
  const [testName, setTestName] = useState('')
  const [testDescription, setTestDescription] = useState('')
  const [selectedStartingUrl, setSelectedStartingUrl] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (initialConfig) {
        setTestName(initialConfig.name)
        setTestDescription(initialConfig.description)
        setSelectedStartingUrl(initialConfig.startingUrl)
      } else {
        setTestName('New Test')
        setTestDescription('Created with Test Builder')
        if (project?.urls && project.urls.length > 0) {
          setSelectedStartingUrl(project.urls[0].url)
        }
      }
      setErrors({})
    }
  }, [isOpen, initialConfig, project])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        handleCancel()
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSave()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!testName.trim()) newErrors.name = 'Test name is required'
    if (!selectedStartingUrl) newErrors.startingUrl = 'Starting URL is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setSaving(true)
    try {
      onSave({
        name: testName.trim(),
        description: testDescription.trim(),
        startingUrl: selectedStartingUrl
      })
      await new Promise(resolve => setTimeout(resolve, 300))
      onClose()
    } catch (error) {
      console.error('Failed to save configuration:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => onClose()

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={handleCancel}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <Settings size={16} style={{ color: 'var(--moss)', marginTop: 2 }} />
            <div>
              <div className="modal-title">
                {isEdit ? 'Edit test configuration' : 'Configure new test'}
              </div>
              <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
                Set up your test details and starting conditions.
              </div>
            </div>
          </div>
          <button type="button" onClick={handleCancel} className="icon-btn" aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="modal-body col" style={{ gap: 16 }}>
          {project && (
            <div
              style={{
                background: 'var(--moss-soft)',
                border: '1px solid var(--moss-edge)',
                borderRadius: 6,
                padding: 12,
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div>
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: 'var(--moss)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 2,
                    }}
                  >
                    Project
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                    {project.name}
                  </div>
                </div>
                {isEdit && (
                  <span className="pill" style={{ background: 'var(--surface)', color: 'var(--moss)', borderColor: 'var(--moss-edge)' }}>
                    <Pencil size={11} />
                    Editing
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="col" style={{ gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
              Test name <span style={{ color: 'var(--clay)' }}>*</span>
            </label>
            <input
              type="text"
              className="field"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="Enter a descriptive name for your test"
              autoFocus
              style={errors.name ? { borderColor: 'var(--clay)', background: 'var(--clay-soft)' } : undefined}
            />
            {errors.name && (
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--clay)' }}>{errors.name}</p>
            )}
          </div>

          <div className="col" style={{ gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
              Test description
            </label>
            <textarea
              className="field"
              value={testDescription}
              onChange={(e) => setTestDescription(e.target.value)}
              rows={3}
              placeholder="Describe what this test does (optional)"
              style={{ resize: 'vertical', minHeight: 64, fontFamily: 'inherit' }}
            />
            <p className="dim" style={{ margin: 0, fontSize: 11 }}>
              Provide a clear description of what this test validates.
            </p>
          </div>

          <div className="col" style={{ gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
              Starting URL <span style={{ color: 'var(--clay)' }}>*</span>
            </label>
            <select
              className="field"
              value={selectedStartingUrl}
              onChange={(e) => setSelectedStartingUrl(e.target.value)}
              style={errors.startingUrl ? { borderColor: 'var(--clay)', background: 'var(--clay-soft)' } : undefined}
            >
              <option value="">Select the starting page for this test…</option>
              {project?.urls?.map((projectUrl) => (
                <option key={projectUrl.id} value={projectUrl.url}>
                  {projectUrl.title || new URL(projectUrl.url).pathname} — {projectUrl.url}
                </option>
              ))}
            </select>
            {errors.startingUrl && (
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--clay)' }}>{errors.startingUrl}</p>
            )}
            <p className="dim" style={{ margin: 0, fontSize: 11 }}>
              Choose which page the test should start from.
            </p>
          </div>

          {project?.urls && (
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--hair)',
                borderRadius: 6,
                padding: 10,
              }}
            >
              <div className="dim" style={{ fontSize: 11.5 }}>
                <span className="tabular" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                  {project.urls.length}
                </span>{' '}
                page{project.urls.length !== 1 ? 's' : ''} available in this project
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          <div className="dim" style={{ fontSize: 11 }}>
            Press <kbd className="kbd">Esc</kbd> to cancel · <kbd className="kbd">Ctrl+Enter</kbd> to save
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn btn-ghost" onClick={handleCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!testName.trim() || !selectedStartingUrl || saving}
              style={
                !testName.trim() || !selectedStartingUrl || saving
                  ? { opacity: 0.5, cursor: 'not-allowed' }
                  : undefined
              }
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>
                {saving ? 'Saving…' : isEdit ? 'Update configuration' : 'Start building test'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

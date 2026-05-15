import { useState } from 'react';
import { Loader2, Plus, Sparkles, X } from 'lucide-react';
import { Project, TestStats } from './types';

// Feature flag: AI test generation — hidden until Anthropic API billing is funded (pre-launch).
const AI_TEST_GEN_ENABLED = false;

interface ProjectOverviewTabProps {
  project: Project;
  testStats: TestStats | null;
  analyzing: boolean;
  currentAnalysisStep: string;
  analysisProgressPercent: number;
  onSetActiveTab: (tab: 'urls') => void;
  onShowAnalysisModal: () => void;
  onGenerateTests: () => Promise<void>;
  isGeneratingTests: boolean;
}

export function ProjectOverviewTab({
  project,
  testStats,
  analyzing,
  currentAnalysisStep,
  analysisProgressPercent,
  onSetActiveTab,
  onShowAnalysisModal,
  onGenerateTests,
  isGeneratingTests,
}: ProjectOverviewTabProps) {
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);

  return (
    <div className="col" style={{ gap: 16 }}>
      {/* Empty Project Setup Guide */}
      {project.urls.length === 0 && (
        <div
          className="card"
          style={{
            background: 'var(--moss-soft)',
            borderColor: 'var(--moss-edge)',
            padding: '28px 24px',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              fontFamily: 'Inter Tight',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              margin: '0 0 8px',
            }}
          >
            Get started
          </h2>
          <p
            style={{
              color: 'var(--ink-2)',
              fontSize: 13,
              lineHeight: 1.5,
              margin: '0 auto 20px',
              maxWidth: 540,
            }}
          >
            Your project is ready. Add URLs and start discovering testable elements to build
            your automated test suite.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              marginBottom: 20,
              textAlign: 'left',
            }}
          >
            {[
              { n: 1, t: 'Add URLs', d: 'Start by adding the web pages you want to test.' },
              { n: 2, t: 'Analyze pages', d: 'The engine discovers testable elements automatically.' },
              { n: 3, t: 'Build tests', d: 'Use discovered elements to create automated tests.' },
            ].map((s) => (
              <div
                key={s.n}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--hair)',
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <div
                  className="tabular"
                  style={{
                    fontFamily: 'Inter Tight',
                    fontSize: 22,
                    fontWeight: 600,
                    color: 'var(--moss)',
                    marginBottom: 6,
                  }}
                >
                  {s.n}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                  {s.t}
                </div>
                <div className="dim" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                  {s.d}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onSetActiveTab('urls')}
            className="btn btn-primary"
          >
            <Plus size={13} />
            <span>Add your first URL</span>
          </button>
        </div>
      )}

      {/* Analysis Controls — only when project has URLs */}
      {project.urls.length > 0 && (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Project Analysis</span>
          </div>
          <div className="card-pad col" style={{ gap: 14 }}>
            <div>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                  Analysis Progress
                </span>
                <span className="dim" style={{ fontSize: 11.5 }}>
                  {currentAnalysisStep}
                </span>
              </div>
              <div
                onDoubleClick={onShowAnalysisModal}
                title="Double-click for details"
                style={{
                  width: '100%',
                  height: 6,
                  background: 'var(--surface-2)',
                  borderRadius: 999,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${analysisProgressPercent}%`,
                    background:
                      analyzing && analysisProgressPercent < 100
                        ? 'var(--slate)'
                        : analysisProgressPercent === 100
                        ? 'var(--moss)'
                        : 'var(--ink-4)',
                    transition: 'width .5s ease, background .3s ease',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
              }}
            >
              <StatBox label="Passed" value={testStats?.totalPassed ?? 0} color="var(--moss)" />
              <StatBox label="Failed" value={testStats?.totalFailed ?? 0} color="var(--clay)" />
              <StatBox label="Regressions" value={testStats?.regressions ?? 0} color="var(--amber)" />
              <StatBox label="Success rate" value={`${testStats?.successRate ?? 0}%`} color="var(--slate)" />
            </div>
            {testStats && testStats.totalExecutions === 0 && (
              <p className="dim" style={{ fontSize: 11.5, textAlign: 'center', margin: 0 }}>
                No test executions yet. Run tests to see statistics.
              </p>
            )}
          </div>
        </div>
      )}

      {/* AI Test Generation */}
      {AI_TEST_GEN_ENABLED && project._count.elements > 0 && (
        <div
          className="card"
          style={{
            background: 'var(--moss-soft)',
            borderColor: 'var(--moss-edge)',
          }}
        >
          <div className="card-pad">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div
                  className="row"
                  style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}
                >
                  <Sparkles size={14} style={{ color: 'var(--moss)' }} />
                  <span
                    style={{
                      fontFamily: 'Inter Tight',
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--ink)',
                    }}
                  >
                    AI Test Generation
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>
                  Generate a comprehensive test suite using Claude AI. Tests are created from your
                  discovered elements, navigation paths, and authentication flows.
                </p>
                <div className="row dim" style={{ gap: 12, fontSize: 11, marginTop: 8 }}>
                  <span>{project._count.elements} elements available</span>
                  <span>·</span>
                  <span>{project._count.urls} pages indexed</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateConfirm(true)}
                disabled={isGeneratingTests}
                className="btn btn-primary"
                style={isGeneratingTests ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
              >
                {isGeneratingTests ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Generating…</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>Generate test suite</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Confirmation Modal */}
      {showGenerateConfirm && (
        <div className="modal-backdrop" onClick={() => setShowGenerateConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                <Sparkles size={16} style={{ color: 'var(--moss)', marginTop: 1 }} />
                <div className="modal-title">Generate Test Suite with AI</div>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowGenerateConfirm(false)}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div className="modal-body col" style={{ gap: 8 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                Claude AI will analyse your {project._count.elements} discovered elements and{' '}
                {project._count.urls} pages to generate a comprehensive test suite covering
                authentication, navigation, forms, tables, and end-to-end workflows. Generated
                tests will be saved as drafts.
              </p>
              <p className="dim" style={{ margin: 0, fontSize: 11.5 }}>
                This may take 1-2 minutes depending on the number of pages and elements.
              </p>
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowGenerateConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setShowGenerateConfirm(false);
                  onGenerateTests();
                }}
              >
                <Sparkles size={13} />
                <span>Generate Tests</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--hair)',
        borderRadius: 6,
        padding: '10px 12px',
        textAlign: 'center',
      }}
    >
      <div
        className="tabular"
        style={{
          fontFamily: 'Inter Tight',
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color,
        }}
      >
        {value}
      </div>
      <div className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Check, ExternalLink, Table as TableIcon } from 'lucide-react';
import { ProjectElement } from '../../types/element.types';
import { TableExplorerModal } from './TableExplorerModal';
import { CellStepData } from './CellSelectorPopover';
import { Pill } from '../ui/Pill';

interface TablePreviewCardProps {
  element: ProjectElement;
  onSelectElement: (element: ProjectElement) => void;
  onAddStep?: (step: CellStepData) => void;
}

export function TablePreviewCard({ element, onSelectElement, onAddStep }: TablePreviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [copiedSelector, setCopiedSelector] = useState<string | null>(null);

  const tableData = element.tableData || (element.attributes as any)?.tableData;
  if (!tableData) return null;

  const { headers, rowCount, sampleData, tableSelector, rowSelectors } = tableData;
  const displayRows = sampleData?.slice(0, expanded ? 10 : 3) || [];

  const handleCopy = async (e: React.MouseEvent, selector: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(selector);
      setCopiedSelector(selector);
      setTimeout(() => setCopiedSelector(null), 1500);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleToggleExplorer = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowExplorer(!showExplorer);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectElement(element);
    }
  };

  const hasExplorerData = tableData.cellSelectors && tableData.cellSelectors.length > 0;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectElement(element)}
        onKeyDown={handleKeyDown}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hair)',
          borderRadius: 8,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'border-color .12s ease, box-shadow .12s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--moss)';
          e.currentTarget.style.boxShadow = 'var(--shadow-1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--hair)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Header */}
        <div
          className="row"
          style={{
            padding: '8px 12px',
            background: 'var(--moss-soft)',
            borderBottom: '1px solid var(--moss-edge)',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <TableIcon size={14} style={{ color: 'var(--moss)', flexShrink: 0 }} />
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--ink)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {element.description || 'Data Table'}
          </span>
          <Pill kind="ok" dot={false}>
            {rowCount} row{rowCount !== 1 ? 's' : ''}
          </Pill>
          {hasExplorerData && (
            <button
              type="button"
              onClick={handleToggleExplorer}
              className="btn btn-outline btn-sm"
              style={{
                color: 'var(--moss)',
                borderColor: 'var(--moss-edge)',
                background: 'var(--surface)',
              }}
            >
              <ExternalLink size={11} />
              <span>Open explorer</span>
            </button>
          )}
        </div>

        {/* Table selector */}
        {tableSelector && (
          <div
            className="row"
            style={{
              padding: '6px 12px',
              background: 'var(--surface-2)',
              borderBottom: '1px solid var(--hair)',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <span className="dim" style={{ fontSize: 11, flexShrink: 0 }}>
              Table:
            </span>
            <code
              className="mono"
              onClick={(e) => handleCopy(e, tableSelector)}
              title="Click to copy"
              style={{
                fontSize: 11,
                color: 'var(--slate)',
                background: 'var(--surface)',
                border: '1px solid var(--hair)',
                padding: '2px 6px',
                borderRadius: 4,
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {copiedSelector === tableSelector ? 'Copied!' : tableSelector}
            </code>
          </div>
        )}

        {/* Mini table preview */}
        {headers && headers.length > 0 && (
          <div style={{ overflowX: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th
                    style={{
                      padding: '5px 8px',
                      textAlign: 'left',
                      color: 'var(--ink-3)',
                      fontWeight: 600,
                      width: 32,
                      borderBottom: '1px solid var(--hair)',
                    }}
                  >
                    #
                  </th>
                  {headers.slice(0, 5).map((header: string, i: number) => (
                    <th
                      key={i}
                      style={{
                        padding: '5px 8px',
                        textAlign: 'left',
                        color: 'var(--ink)',
                        fontWeight: 600,
                        maxWidth: 120,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        borderBottom: '1px solid var(--hair)',
                      }}
                    >
                      {header || `Col ${i + 1}`}
                    </th>
                  ))}
                  {headers.length > 5 && (
                    <th
                      style={{
                        padding: '5px 8px',
                        color: 'var(--ink-3)',
                        borderBottom: '1px solid var(--hair)',
                      }}
                    >
                      +{headers.length - 5}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row: string[], rowIdx: number) => (
                  <tr key={rowIdx} style={{ borderTop: '1px solid var(--hair)' }}>
                    <td style={{ padding: '5px 8px', color: 'var(--ink-3)' }}>
                      {rowSelectors?.[rowIdx] ? (
                        <button
                          type="button"
                          onClick={(e) => handleCopy(e, rowSelectors[rowIdx])}
                          title={`Copy: ${rowSelectors[rowIdx]}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            color: copiedSelector === rowSelectors[rowIdx] ? 'var(--moss)' : 'inherit',
                          }}
                        >
                          {copiedSelector === rowSelectors[rowIdx] ? <Check size={11} /> : rowIdx + 1}
                        </button>
                      ) : (
                        rowIdx + 1
                      )}
                    </td>
                    {row.slice(0, 5).map((cell: string, cellIdx: number) => (
                      <td
                        key={cellIdx}
                        style={{
                          padding: '5px 8px',
                          color: 'var(--ink-2)',
                          maxWidth: 120,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cell || '-'}
                      </td>
                    ))}
                    {row.length > 5 && (
                      <td style={{ padding: '5px 8px', color: 'var(--ink-3)' }}>…</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sampleData && sampleData.length > 3 && (
          <button
            type="button"
            onClick={handleToggleExpand}
            style={{
              width: '100%',
              padding: '6px 12px',
              fontSize: 11,
              color: 'var(--ink-3)',
              background: 'var(--surface-2)',
              border: 'none',
              borderTop: '1px solid var(--hair)',
              cursor: 'pointer',
              transition: 'background .12s ease, color .12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface)';
              e.currentTarget.style.color = 'var(--ink)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface-2)';
              e.currentTarget.style.color = 'var(--ink-3)';
            }}
          >
            {expanded ? 'Show less' : `Show ${Math.min(sampleData.length, 10) - 3} more rows`}
          </button>
        )}
      </div>

      {hasExplorerData && (
        <TableExplorerModal
          open={showExplorer}
          tableData={tableData}
          onClose={() => setShowExplorer(false)}
          onAddStep={onAddStep}
          title={element.description || 'Data Table'}
        />
      )}
    </div>
  );
}

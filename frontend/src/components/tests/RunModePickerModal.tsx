import { useEffect } from 'react';

interface RunModePickerModalProps {
  open: boolean;
  testName: string;
  onCancel: () => void;
  onPick: (mode: 'headed' | 'headless') => void;
}

export function RunModePickerModal({ open, testName, onCancel, onPick }: RunModePickerModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Run "{testName}"
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Choose how the test should run.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => onPick('headed')}
              className="w-full p-4 text-left rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <div className="font-medium text-gray-900 dark:text-gray-100">Headed</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                A real Chromium window opens on the host. Watch the test execute live.
                Video is recorded; progress streams to the modal.
                Falls back to headless if the host has no display.
              </div>
            </button>
            <button
              onClick={() => onPick('headless')}
              className="w-full p-4 text-left rounded-lg border border-gray-200 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
            >
              <div className="font-medium text-gray-900 dark:text-gray-100">Headless</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                No browser window opens. Same video recording, same step-by-step progress
                streamed to the modal. Faster on busy machines.
              </div>
            </button>
          </div>
          <button
            onClick={onCancel}
            className="mt-4 w-full text-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'info' | 'warning' | 'danger' | 'success'
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info'
}: ConfirmationModalProps) {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          icon: '✅',
          headerBg: 'bg-green-50',
          headerText: 'text-green-900',
          confirmBg: 'bg-green-600 hover:bg-green-700',
        }
      case 'warning':
        return {
          icon: '⚠️',
          headerBg: 'bg-yellow-50',
          headerText: 'text-yellow-900',
          confirmBg: 'bg-yellow-600 hover:bg-yellow-700',
        }
      case 'danger':
        return {
          icon: '❌',
          headerBg: 'bg-red-50',
          headerText: 'text-red-900',
          confirmBg: 'bg-red-600 hover:bg-red-700',
        }
      default:
        return {
          icon: 'ℹ️',
          headerBg: 'bg-blue-50',
          headerText: 'text-blue-900',
          confirmBg: 'bg-blue-600 hover:bg-blue-700',
        }
    }
  }

  const styles = getVariantStyles()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className={`px-6 py-4 border-b border-gray-200 ${styles.headerBg}`}>
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{styles.icon}</span>
            <h2 className={`text-lg font-bold ${styles.headerText}`}>{title}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-gray-700 whitespace-pre-wrap">{message}</p>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-white rounded-lg transition-colors ${styles.confirmBg}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

interface InfoModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  variant?: 'info' | 'warning' | 'error' | 'success'
  buttonText?: string
}

export function InfoModal({
  isOpen,
  onClose,
  title,
  message,
  variant = 'info',
  buttonText = 'OK'
}: InfoModalProps) {
  if (!isOpen) return null

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          icon: '✓',
          headerBg: 'bg-green-50',
          headerText: 'text-green-900',
          buttonBg: 'bg-green-600 hover:bg-green-700',
        }
      case 'warning':
        return {
          icon: '!',
          headerBg: 'bg-yellow-50',
          headerText: 'text-yellow-900',
          buttonBg: 'bg-yellow-600 hover:bg-yellow-700',
        }
      case 'error':
        return {
          icon: '✕',
          headerBg: 'bg-red-50',
          headerText: 'text-red-900',
          buttonBg: 'bg-red-600 hover:bg-red-700',
        }
      default:
        return {
          icon: 'i',
          headerBg: 'bg-blue-50',
          headerText: 'text-blue-900',
          buttonBg: 'bg-blue-600 hover:bg-blue-700',
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

        {/* Footer Action */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 text-white rounded-lg transition-colors ${styles.buttonBg}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  )
}

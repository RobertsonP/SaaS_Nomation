import React from 'react';

interface LoadingModalProps {
  isOpen: boolean;
  message: string;
  subMessage?: string;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({
  isOpen,
  message,
  subMessage,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center">
          {/* Spinner */}
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-6"></div>
          
          {/* Main message */}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 text-center">
            {message}
          </h3>
          
          {/* Sub message */}
          {subMessage && (
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              {subMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
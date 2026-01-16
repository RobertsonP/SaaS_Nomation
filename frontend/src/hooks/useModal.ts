import { useState, useEffect, useCallback } from 'react';

interface UseModalOptions {
  /**
   * Whether the modal is currently open
   */
  isOpen: boolean;

  /**
   * Callback when the modal should close
   */
  onClose: () => void;

  /**
   * Whether to close on ESC key press (default: true)
   */
  closeOnEsc?: boolean;

  /**
   * Whether to prevent body scrolling when open (default: true)
   */
  preventScroll?: boolean;

  /**
   * Whether to close when clicking the backdrop (default: false)
   */
  closeOnBackdropClick?: boolean;
}

/**
 * Custom hook for common modal behavior:
 * - ESC key handling
 * - Body scroll prevention
 * - Optional backdrop click handling
 *
 * @example
 * ```tsx
 * function MyModal({ isOpen, onClose }) {
 *   useModal({ isOpen, onClose });
 *
 *   if (!isOpen) return null;
 *   return <div className="modal">...</div>;
 * }
 * ```
 */
export function useModal({
  isOpen,
  onClose,
  closeOnEsc = true,
  preventScroll = true,
  closeOnBackdropClick = false,
}: UseModalOptions) {
  // Handle ESC key press
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, closeOnEsc]);

  // Prevent body scrolling
  useEffect(() => {
    if (!preventScroll) return;

    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow || 'unset';
      };
    }
  }, [isOpen, preventScroll]);

  // Backdrop click handler
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (closeOnBackdropClick && event.target === event.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdropClick, onClose]
  );

  return {
    /**
     * Handler for backdrop click - attach to the modal backdrop element
     */
    handleBackdropClick,
  };
}

/**
 * Hook for handling modal state with additional features
 */
export function useModalState(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
    setIsOpen,
  };
}

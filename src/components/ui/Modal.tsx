import { useEffect, useCallback, useRef, type ReactNode } from 'react';

export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Optional title displayed in the header */
  title?: string;
  /** Modal content */
  children: ReactNode;
  /** Modal width size */
  size?: 'sm' | 'md' | 'lg';
  /** Show close button in header */
  showCloseButton?: boolean;
  /** Close modal when clicking backdrop */
  closeOnBackdrop?: boolean;
  /** Close modal when pressing Escape */
  closeOnEscape?: boolean;
  /** Z-index for the modal (default: 200) */
  zIndex?: number;
  /** ID for aria-labelledby (auto-generated if title provided) */
  ariaLabelledBy?: string;
}

const sizeClasses = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-md',
  lg: 'md:max-w-lg',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  zIndex = 200,
  ariaLabelledBy,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = ariaLabelledBy || (title ? 'modal-title' : undefined);

  // Handle Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  // Set up keyboard listener and focus trap
  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('keydown', handleKeyDown, true);
    
    // Focus the modal when opened
    modalRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, handleKeyDown]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(() => {
    if (closeOnBackdrop) {
      onClose();
    }
  }, [closeOnBackdrop, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        style={{ zIndex }}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal container */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full ${sizeClasses[size]} rounded-xl shadow-2xl overflow-hidden fade-in`}
        style={{
          zIndex: zIndex + 1,
          backgroundColor: 'var(--reader-bg)',
          color: 'var(--reader-text)',
          border: '1px solid rgba(128, 128, 128, 0.3)',
        }}
      >
        {/* Header with title and close button */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 pb-4">
            {title && (
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full opacity-60 hover:opacity-100 transition-opacity ml-auto"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={title || showCloseButton ? "px-6 pb-6" : "p-6"}>
          {children}
        </div>
      </div>
    </>
  );
}

export default Modal;

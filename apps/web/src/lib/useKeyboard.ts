import { useEffect } from 'react';

interface KeyboardHandlers {
  onSpace?: () => void;
  onLeftArrow?: () => void;
  onRightArrow?: () => void;
  onF?: () => void;
  onM?: () => void;
  onEscape?: () => void;
  onBracketLeft?: () => void;
  onBracketRight?: () => void;
}

export function useKeyboard(handlers: KeyboardHandlers, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          handlers.onSpace?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlers.onLeftArrow?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handlers.onRightArrow?.();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          handlers.onF?.();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          handlers.onM?.();
          break;
        case 'Escape':
          handlers.onEscape?.();
          break;
        case '[':
          e.preventDefault();
          handlers.onBracketLeft?.();
          break;
        case ']':
          e.preventDefault();
          handlers.onBracketRight?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, enabled]);
}

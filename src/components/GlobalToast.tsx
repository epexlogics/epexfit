/**
 * GlobalToast — Re-export convenience
 *
 * Usage:
 *   const { show } = useToast();
 *   show({ message: 'Saved!', variant: 'success' });
 *
 * Wrap your app with <ToastProvider> (already done in App.tsx patch).
 */
export { ToastProvider, useToast } from '../contexts/ToastContext';
export type { ToastOptions, ToastVariant } from '../contexts/ToastContext';

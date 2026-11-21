import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmationDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  variant = 'danger'
}: ConfirmationDialogProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertTriangle size={24} className="text-rose-600" />,
          iconBg: 'bg-rose-100',
          confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={24} className="text-amber-600" />,
          iconBg: 'bg-amber-100',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
        };
      default:
        return {
          icon: <AlertTriangle size={24} className="text-primary" />,
          iconBg: 'bg-primary/10',
          confirmBtn: 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="bg-card border border-border rounded-3xl w-full max-w-sm overflow-hidden flex flex-col relative z-10 shadow-2xl"
          >
            <button 
              onClick={onCancel}
              className="absolute right-4 top-4 p-2 text-muted-foreground hover:bg-accent rounded-full transition-colors"
            >
              <X size={16} />
            </button>
            
            <div className="p-6 pb-2 flex flex-col items-center text-center">
              <div className={`p-4 rounded-full mb-4 ${styles.iconBg}`}>
                {styles.icon}
              </div>
              <h3 className="text-xl font-black mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {message}
              </p>
            </div>

            <div className="p-6 flex flex-col sm:flex-row gap-3 mt-2">
              <button 
                onClick={onCancel}
                className="flex-1 px-4 py-3 rounded-2xl font-bold bg-accent hover:bg-accent/80 text-foreground transition-all"
              >
                {cancelText}
              </button>
              <button 
                onClick={() => {
                  onConfirm();
                  onCancel();
                }}
                className={`flex-1 px-4 py-3 rounded-2xl font-bold shadow-lg transition-all active:scale-95 ${styles.confirmBtn}`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

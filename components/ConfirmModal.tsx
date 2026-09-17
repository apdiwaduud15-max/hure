import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title = "Ma hubtaa? (Are you sure?)",
  message = "Ma hubtaa inaad tirtirto kankan? Tallaabadan dib looma noqon karo.",
  confirmText = "Haa (Yes, Delete)",
  cancelText = "Maya (No, Cancel)",
  onConfirm,
  onClose,
  type = 'danger'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 relative overflow-hidden transform transition-all scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button top right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center space-y-4 pt-2">
          {/* Icon Badge */}
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-inner ${
            type === 'danger' 
              ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 ring-8 ring-rose-50 dark:ring-rose-950/30' 
              : 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 ring-8 ring-amber-50 dark:ring-amber-950/30'
          }`}>
            {type === 'danger' ? <Trash2 size={32} /> : <AlertTriangle size={32} />}
          </div>

          {/* Heading */}
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {title}
            </h3>
            <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
              {message}
            </p>
          </div>

          {/* Action Buttons: Maya (No) & Haa (Yes) */}
          <div className="grid grid-cols-2 gap-3 w-full pt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-2xl transition-all uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`w-full py-3.5 px-4 font-black text-xs rounded-2xl transition-all uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 text-white ${
                type === 'danger' 
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30 dark:shadow-rose-900/40' 
                  : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
              }`}
            >
              <Trash2 size={16} />
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;

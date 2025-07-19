
import React, { ReactNode } from 'react';
import { ICONS } from '../constants';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'normal' | 'large';
}

const Modal: React.FC<ModalProps> = ({ title, onClose, children, size = 'normal' }) => {
  const sizeClass = size === 'large' ? 'max-w-4xl' : 'max-w-xl';

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className={`bg-brand-surface/90 backdrop-blur-lg w-full ${sizeClass} rounded-2xl shadow-xl flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-brand-border flex-shrink-0">
          <h2 className="text-lg font-bold font-display text-brand-text-primary">{title}</h2>
          <button onClick={onClose} className="p-2 text-brand-text-secondary hover:text-brand-text-primary rounded-full hover:bg-slate-100 transition-colors">
            {ICONS.close}
          </button>
        </header>
        <main className="p-6 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Modal;
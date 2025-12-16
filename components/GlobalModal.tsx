import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface GlobalModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export const GlobalModal: React.FC<GlobalModalProps> = ({ isOpen, title, message, onClose }) => {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isOpen) {
      timer = setTimeout(() => {
        onClose();
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-8"
      onClick={onClose}
    >
      <div 
        className="max-w-lg w-full bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden relative transform transition-all scale-100"
        onClick={(e) => e.stopPropagation()} // Prevent click through
      >
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-white"
        >
          <X size={20} />
        </button>
        
        <div className="p-8 text-center">
          <h2 className="text-3xl font-bold font-mono text-white mb-4 tracking-tighter uppercase">{title}</h2>
          <div className="w-16 h-1 bg-red-600 mx-auto mb-6"></div>
          <p className="text-gray-300 text-lg font-mono leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>
        
        <div className="bg-black/50 p-2 text-center border-t border-gray-800">
          <p className="text-[10px] text-gray-500 font-mono">TAP ANYWHERE TO DISMISS</p>
        </div>
      </div>
    </div>
  );
};
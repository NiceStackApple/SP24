
import React from 'react';
import { X, Github, Instagram, ExternalLink, Heart } from 'lucide-react';

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreditModal: React.FC<CreditModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[95%] md:w-full max-w-md overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-yellow-500 to-red-600 opacity-50"></div>
        
        <div className="p-3 md:p-4 border-b border-gray-800 flex items-center justify-between bg-black/50">
           <h2 className="text-sm md:text-lg font-bold font-mono text-white tracking-widest uppercase">Developer Intel</h2>
           <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X size={18} className="md:w-5 md:h-5" />
           </button>
        </div>

        <div className="p-5 md:p-8 flex flex-col items-center text-center">
           <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-gray-800 border-2 border-yellow-600 mb-4 md:mb-6 flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(202,138,4,0.3)]">
              <img 
                src="https://github.com/NiceStackApple.png" 
                alt="Tsaqif Nico" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/bottts/svg?seed=Nico';
                }}
              />
           </div>

           <h3 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase mb-1">Tsaqif Nico</h3>
           <p className="text-yellow-500 font-mono text-[10px] md:text-xs tracking-widest uppercase mb-6">Lead Architect // Survival Protocol</p>
           
           <div className="bg-black/30 border border-gray-800 p-3 md:p-4 rounded-lg w-full mb-6 md:mb-8">
              <p className="text-gray-400 text-xs md:text-sm font-mono leading-relaxed">
                Thank you for participating in the simulation. This project was built to test strategic decision making under extreme pressure.
              </p>
           </div>

           <div className="grid grid-cols-1 w-full gap-2 md:gap-3">
              <a 
                href="https://github.com/NiceStackApple" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 md:p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-700 hover:border-yellow-600 transition-all group"
              >
                 <div className="flex items-center gap-2 md:gap-3">
                    <Github className="text-gray-400 group-hover:text-white w-4 h-4 md:w-5 md:h-5" />
                    <span className="text-xs md:text-sm font-mono text-gray-300">NiceStackApple</span>
                 </div>
                 <ExternalLink size={12} className="text-gray-600 md:w-3.5 md:h-3.5" />
              </a>

              <a 
                href="https://www.instagram.com/codingwithnico/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 md:p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-700 hover:border-pink-600 transition-all group"
              >
                 <div className="flex items-center gap-2 md:gap-3">
                    <Instagram className="text-gray-400 group-hover:text-pink-500 w-4 h-4 md:w-5 md:h-5" />
                    <span className="text-xs md:text-sm font-mono text-gray-300">@codingwithnico</span>
                 </div>
                 <ExternalLink size={12} className="text-gray-600 md:w-3.5 md:h-3.5" />
              </a>
           </div>

           <div className="mt-6 md:mt-8 flex items-center gap-2 text-[10px] text-gray-600 font-mono tracking-widest uppercase">
              MADE WITH <Heart size={10} className="text-red-600 fill-red-600" /> BY NICO
           </div>
        </div>

        <div className="bg-black/50 p-2 text-center border-t border-gray-800">
           <p className="text-[8px] md:text-[9px] text-gray-700 font-mono uppercase tracking-[0.3em]">SECURE CONNECTION // ENCRYPTED</p>
        </div>
      </div>
    </div>
  );
};

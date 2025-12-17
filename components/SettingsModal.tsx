
import React, { useState } from 'react';
import { X, Volume2, LogOut, AlertTriangle } from 'lucide-react';
import { audioManager } from '../services/audioService';
import { PlayerStatus } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerStatus: PlayerStatus;
  onExit: () => void;
  onSurrender: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  playerStatus,
  onExit,
  onSurrender
}) => {
  const [volume, setVolume] = useState(40);

  if (!isOpen) return null;

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseInt(e.target.value);
      setVolume(v);
      audioManager.setMasterVolume(v / 100);
  };

  const isAlive = playerStatus === PlayerStatus.ALIVE;

  return (
    <div 
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
         <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-black/50">
            <h2 className="text-lg font-bold font-mono text-white tracking-widest">SETTINGS</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white">
               <X size={20} />
            </button>
         </div>

         <div className="p-6 space-y-8">
            {/* Volume Control */}
            <div>
               <div className="flex items-center gap-2 text-gray-400 mb-2">
                  <Volume2 size={18} />
                  <span className="font-mono text-xs uppercase">Audio Volume</span>
               </div>
               <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={volume} 
                  onChange={handleVolumeChange}
                  className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
               />
               <div className="flex justify-between text-[10px] text-gray-600 font-mono mt-1">
                  <span>MUTE</span>
                  <span>MAX</span>
               </div>
            </div>

            {/* Context Action */}
            <div className="pt-4 border-t border-gray-800">
               {isAlive ? (
                   <button 
                      onClick={() => { onClose(); onSurrender(); }}
                      className="w-full py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-500 rounded font-mono font-bold text-sm tracking-widest flex items-center justify-center gap-2 group transition-all"
                   >
                      <AlertTriangle size={16} className="group-hover:animate-pulse" />
                      SURRENDER
                   </button>
               ) : (
                   <button 
                      onClick={() => { onClose(); onExit(); }}
                      className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded font-mono font-bold text-sm tracking-widest flex items-center justify-center gap-2 transition-all"
                   >
                      <LogOut size={16} />
                      EXIT MATCH
                   </button>
               )}
               <p className="text-[10px] text-gray-600 text-center mt-2 font-mono">
                  {isAlive ? "Warning: Surrendering invalidates match stats." : "Safe to exit. Match recording complete."}
               </p>
            </div>
         </div>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { X, Skull, Zap, AlertTriangle, Play, Trophy, ShieldAlert, Crosshair, Flame, Biohazard, Ghost } from 'lucide-react';
import { Player, PlayerStatus } from '../types';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  day: number;
  adminNoCost: boolean;
  onSetDay: (d: number) => void;
  onForceEvent: (type: string) => void;
  onKillPlayer: (id: string) => void;
  onToggleNoCost: () => void;
  onSimulateWin: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  players,
  day,
  adminNoCost,
  onSetDay,
  onForceEvent,
  onKillPlayer,
  onToggleNoCost,
  onSimulateWin
}) => {
  const [dayInput, setDayInput] = useState(day.toString());

  if (!isOpen) return null;

  const handleDayChange = (e: React.FormEvent) => {
      e.preventDefault();
      const d = parseInt(dayInput);
      if (!isNaN(d) && d > 0) {
          onSetDay(d);
      }
  };

  const activePlayers = players.filter(p => p.status === PlayerStatus.ALIVE);

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border-2 border-yellow-700/50 rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
         {/* STRIPES */}
         <div className="absolute top-0 left-0 w-full h-1 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#ca8a04_10px,#ca8a04_20px)] opacity-50"></div>

         <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-black/50">
            <div className="flex items-center gap-3">
               <AlertTriangle size={24} className="text-yellow-500" />
               <div>
                   <h2 className="text-xl font-black font-mono text-white tracking-[0.2em] uppercase">ADMIN CONTROL</h2>
                   <p className="text-[10px] text-yellow-600 font-mono uppercase tracking-wider">UNAUTHORIZED ACCESS RESTRICTED</p>
               </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white">
               <X size={24} />
            </button>
         </div>

         <div className="flex-1 overflow-y-auto p-6 space-y-8 font-mono">
            
            {/* SECTION 1: WORLD STATE */}
            <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 border-b border-gray-800 pb-1">World Simulation</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Day Control */}
                    <form onSubmit={handleDayChange} className="bg-black/30 p-4 rounded border border-gray-800 flex items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-[10px] text-gray-500 mb-1">CURRENT DAY</label>
                            <input 
                                type="number" 
                                value={dayInput} 
                                onChange={(e) => setDayInput(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded font-mono focus:border-yellow-600 focus:outline-none"
                            />
                        </div>
                        <button type="submit" className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded self-end border border-gray-600">
                            SET DAY
                        </button>
                    </form>

                    {/* Toggles */}
                    <div className="bg-black/30 p-4 rounded border border-gray-800 flex items-center justify-between">
                        <div>
                            <div className="text-white font-bold">NO COST MODE</div>
                            <div className="text-[10px] text-gray-500">Disable Hunger/Fatigue drain</div>
                        </div>
                        <button 
                            onClick={onToggleNoCost}
                            className={`w-12 h-6 rounded-full relative transition-colors ${adminNoCost ? 'bg-yellow-600' : 'bg-gray-700'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${adminNoCost ? 'left-7' : 'left-1'}`}></div>
                        </button>
                    </div>
                </div>
            </section>

            {/* SECTION 2: FORCE EVENTS */}
            <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 border-b border-gray-800 pb-1">Force Events</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <button onClick={() => onForceEvent('VOLCANO')} className="flex flex-col items-center justify-center gap-2 p-3 bg-red-900/20 hover:bg-red-900/40 border border-red-800 rounded transition-all group">
                        <Flame size={20} className="text-red-500 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold text-red-400">VOLCANO</span>
                    </button>
                    <button onClick={() => onForceEvent('GAS')} className="flex flex-col items-center justify-center gap-2 p-3 bg-green-900/20 hover:bg-green-900/40 border border-green-800 rounded transition-all group">
                        <Biohazard size={20} className="text-green-500 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold text-green-400">GAS</span>
                    </button>
                    <button onClick={() => onForceEvent('SHRINK')} className="flex flex-col items-center justify-center gap-2 p-3 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-800 rounded transition-all group">
                        <ShieldAlert size={20} className="text-blue-500 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold text-blue-400">ZONE SHRINK</span>
                    </button>
                    <button onClick={() => onForceEvent('MONSTER')} className="flex flex-col items-center justify-center gap-2 p-3 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-800 rounded transition-all group">
                        <Ghost size={20} className="text-purple-500 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold text-purple-400">MONSTER</span>
                    </button>
                    <button onClick={() => onForceEvent('PISTOL')} className="flex flex-col items-center justify-center gap-2 p-3 bg-yellow-900/20 hover:bg-yellow-900/40 border border-yellow-800 rounded transition-all group">
                        <Crosshair size={20} className="text-yellow-500 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold text-yellow-400">PISTOL (SELF)</span>
                    </button>
                </div>
            </section>

            {/* SECTION 3: PLAYER MANAGEMENT */}
            <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 border-b border-gray-800 pb-1">Target Elimination</h3>
                <div className="bg-black/30 border border-gray-800 rounded p-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {activePlayers.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-2 hover:bg-gray-800 rounded border-b border-gray-800/50 last:border-0">
                            <div className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full ${p.isBot ? 'bg-gray-500' : 'bg-yellow-500'}`}></span>
                                <span className="text-sm text-gray-300">{p.name}</span>
                                <span className="text-[10px] text-gray-600 bg-black px-1 rounded">{p.hp} HP</span>
                            </div>
                            <button 
                                onClick={() => onKillPlayer(p.id)}
                                className="bg-red-900/20 hover:bg-red-900/50 text-red-500 hover:text-white border border-red-900/50 px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all"
                            >
                                <Skull size={10} /> KILL
                            </button>
                        </div>
                    ))}
                    {activePlayers.length === 0 && <div className="text-gray-600 text-xs text-center py-4">NO ACTIVE TARGETS</div>}
                </div>
            </section>

            {/* SECTION 4: DEBUG ENDGAME */}
            <section className="pt-4 border-t border-gray-800">
                <button 
                    onClick={onSimulateWin}
                    className="w-full py-4 bg-yellow-600 hover:bg-yellow-700 text-black font-bold tracking-[0.2em] rounded flex items-center justify-center gap-3 transition-all"
                >
                    <Trophy size={20} />
                    SIMULATE VICTORY
                </button>
            </section>

         </div>
      </div>
    </div>
  );
};

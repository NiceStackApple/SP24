
import React, { useState, useEffect } from 'react';
import { GameState, ActionType, Phase, PlayerStatus } from '../types';
import { PlayerCard } from './PlayerCard';
import { ActionPanel } from './ActionPanel';
import { GameLog } from './GameLog';
import { ChatPanel } from './ChatPanel';
import { BattleAnimationLayer } from './BattleAnimationLayer';
import { GlobalModal } from './GlobalModal';
import { Clock, Sun, Moon, Eye, Heart, Skull, Loader, Flame, Biohazard, ShieldAlert, Ghost, AlertTriangle, LogOut } from 'lucide-react';

interface GameBoardProps {
  state: GameState;
  pendingAction: { type: ActionType, targetId?: string | null };
  onActionSelect: (type: ActionType, targetId?: string) => void;
  onSendMessage: (text: string, recipient?: string) => void;
  onEquipItem: (item: string) => void;
  onLeaveGame: () => void;
  onSurrender: () => void;
  onCloseModal?: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ 
  state, 
  pendingAction, 
  onActionSelect,
  onSendMessage,
  onEquipItem,
  onLeaveGame,
  onSurrender,
  onCloseModal
}) => {
  const me = state.players.find(p => p.id === state.myPlayerId);
  const isDay = state.phase === Phase.DAY;
  
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [hasShownDeath, setHasShownDeath] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showSurrenderModal, setShowSurrenderModal] = useState(false);

  useEffect(() => {
     if (me?.status === PlayerStatus.DEAD && state.phase !== Phase.GAME_OVER && !isLeaving && !hasShownDeath) {
        // If just died, show modal after delay - ONLY ONCE
        const timer = setTimeout(() => {
           setShowDeathModal(true);
           setHasShownDeath(true);
        }, 2000);
        return () => clearTimeout(timer);
     }
  }, [me?.status, state.phase, isLeaving, hasShownDeath]);

  const handlePlayerClick = (targetId: string) => {
    // Lock interaction if Volcano Event Active
    if (state.volcanoEventActive) return;

    if (pendingAction.type === ActionType.ATTACK || pendingAction.type === ActionType.SHOOT || pendingAction.type === ActionType.HEAL) {
      onActionSelect(pendingAction.type, targetId);
    }
  };

  const handleLeave = () => {
    setIsLeaving(true);
    setShowDeathModal(false);
    setTimeout(() => {
      onLeaveGame();
    }, 1000);
  };

  const handleSurrenderConfirm = () => {
    setIsLeaving(true);
    setShowSurrenderModal(false);
    setTimeout(() => {
       onSurrender();
    }, 1000);
  };

  const aliveCount = state.players.filter(p => p.status === 'ALIVE').length;
  const isVolcanoDay = state.day === state.volcanoDay;
  const isGasDay = state.day === state.gasDay;
  const isZoneDay = state.day === 20 || state.day === 30 || state.day === 45;
  const isMonsterDay = state.day === state.nextMonsterDay;

  // WARNING LOGIC
  const isVolcanoWarning = state.day === state.volcanoDay - 1;
  const isGasWarning = state.day === state.gasDay - 1;

  return (
    <div className={`h-screen w-full flex bg-black text-gray-200 overflow-hidden font-rajdhani relative ${isVolcanoDay && !isDay && !state.volcanoEventActive ? 'animate-shake' : ''} ${state.volcanoEventActive ? 'animate-shake-hard' : ''} ${state.gasEventActive ? 'animate-sway' : ''} ${state.monsterEventActive ? 'animate-shake' : ''}`}>
      <BattleAnimationLayer event={state.currentEvent} />
      
      <GlobalModal 
        isOpen={state.modal.isOpen} 
        title={state.modal.title} 
        message={state.modal.message} 
        onClose={() => onCloseModal && onCloseModal()} 
      />

      {/* SURRENDER MODAL */}
      {showSurrenderModal && (
         <div className="absolute inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-fade-in">
           <div className="max-w-md w-full bg-gray-900 border border-gray-800 p-8 rounded-lg text-center shadow-2xl relative">
              <AlertTriangle size={48} className="text-red-500 mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-tighter">CONFIRM SURRENDER</h2>
              <p className="text-gray-400 mb-6 font-mono text-sm leading-relaxed">
                 Are you sure you want to abandon the match?<br/>
                 <span className="text-red-500 font-bold">All stats gained will be lost.</span>
                 <br/>This action is irreversible.
              </p>
              
              <div className="flex gap-3">
                 <button 
                   onClick={() => setShowSurrenderModal(false)}
                   className="flex-1 py-3 bg-transparent border border-gray-600 text-white font-mono hover:bg-gray-800 transition-colors uppercase tracking-widest"
                 >
                    CANCEL
                 </button>
                 <button 
                   onClick={handleSurrenderConfirm}
                   className="flex-1 py-3 bg-red-700 text-white font-mono hover:bg-red-800 transition-colors uppercase tracking-widest shadow-lg shadow-red-900/20"
                 >
                    SURRENDER
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* DEATH MODAL */}
      {showDeathModal && !isLeaving && !showSurrenderModal && (
        <div className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-fade-in">
           <div className="max-w-md w-full bg-gray-900 border border-gray-800 p-8 rounded-lg text-center shadow-2xl relative overflow-hidden">
               {/* Red decorative line */}
               <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>

               <Skull size={48} className="text-red-600 mx-auto mb-4 animate-pulse" />
               <h2 className="text-4xl font-bold text-white mb-2 uppercase tracking-tighter">You Are Dead</h2>
               <p className="text-gray-400 mb-8 font-mono">Your journey ends here.<br/>What do you want to do?</p>
               
               <div className="space-y-3">
                  <button 
                    onClick={() => setShowDeathModal(false)}
                    className="w-full py-3 bg-transparent border border-gray-600 text-white font-mono hover:bg-gray-800 transition-colors uppercase tracking-widest"
                  >
                     Watch Game (Spectator)
                  </button>
                  <button 
                    onClick={handleLeave}
                    className="w-full py-3 bg-red-700 text-white font-mono hover:bg-red-800 transition-colors uppercase tracking-widest shadow-lg shadow-red-900/20"
                  >
                     Leave Game
                  </button>
               </div>
           </div>
        </div>
      )}

      {/* LEAVING LOADER */}
      {isLeaving && (
         <div className="absolute inset-0 z-[70] bg-black flex flex-col items-center justify-center">
            <Loader className="text-white animate-spin mb-4" size={32} />
            <p className="text-gray-400 font-mono tracking-widest animate-pulse">TERMINATING SESSION...</p>
         </div>
      )}
      
      {/* --- ZONE SHRINK OVERLAY --- */}
      {isZoneDay && (
         <div className="absolute inset-0 z-[40] pointer-events-none overflow-hidden">
             <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(220,38,38,0.5)] animate-pulse"></div>
         </div>
      )}

      {/* --- VOLCANO DISASTER OVERLAY --- */}
      {state.volcanoEventActive && (
         <div className="absolute inset-0 z-[45] pointer-events-none overflow-hidden">
             {/* Red Tint */}
             <div className="absolute inset-0 bg-red-600/20 mix-blend-overlay animate-pulse"></div>
             {/* Heat Haze */}
             <div className="absolute inset-0 backdrop-blur-[2px]"></div>
             {/* Ash Particles */}
             <div className="absolute inset-0 w-full h-full animate-ash bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-repeat opacity-50"></div>
             {/* Vignette */}
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.8)_100%)]"></div>
             
             {/* Center Warning */}
             <div className="absolute top-1/4 left-1/2 -translate-x-1/2 flex flex-col items-center">
                 <h2 className="text-5xl font-black text-red-500 animate-bounce tracking-[0.2em] shadow-black drop-shadow-xl uppercase text-center border-y-4 border-red-600 py-2 bg-black/50 backdrop-blur-md px-12">
                    ERUPTION
                 </h2>
             </div>
         </div>
      )}

      {/* --- GAS DISASTER OVERLAY --- */}
      {state.gasEventActive && (
         <div className="absolute inset-0 z-[45] pointer-events-none overflow-hidden">
             {/* Green Moving Gradient */}
             <div className="absolute inset-0 animate-gas-drift mix-blend-overlay"></div>
             {/* Toxic Pulse (Blur/Distortion) */}
             <div className="absolute inset-0 animate-toxic"></div>
             {/* Noise Grain */}
             <div className="bg-noise"></div>
             {/* Center Warning */}
             <div className="absolute top-1/4 left-1/2 -translate-x-1/2 flex flex-col items-center z-50">
                 <h2 className="text-5xl font-black text-green-500 tracking-[0.2em] shadow-black drop-shadow-xl uppercase text-center border-y-4 border-green-600 py-2 bg-black/50 backdrop-blur-md px-12 animate-pulse">
                    TOXIC GAS
                 </h2>
                 <p className="text-green-300 font-mono mt-2 bg-black/80 px-4 py-1">DEFEND TO SURVIVE</p>
             </div>
         </div>
      )}
      
      {/* --- MONSTER EVENT OVERLAY --- */}
      {state.monsterEventActive && (
         <div className="absolute inset-0 z-[45] pointer-events-none overflow-hidden bg-black/80 mix-blend-multiply animate-pulse">
             {/* Moving Shadows */}
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_transparent_20%,_black_100%)]"></div>
             {/* Eyes in dark */}
             <div className="absolute top-1/3 left-1/4 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_red] animate-ping opacity-50"></div>
             <div className="absolute top-1/3 left-[26%] w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_red] animate-ping opacity-50 delay-75"></div>
             
             <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_red] animate-ping opacity-50 delay-500"></div>
             <div className="absolute bottom-1/3 right-[26%] w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_red] animate-ping opacity-50 delay-700"></div>

             {/* Center Warning */}
             <div className="absolute top-1/4 left-1/2 -translate-x-1/2 flex flex-col items-center z-50">
                 <h2 className="text-5xl font-black text-red-700 tracking-[0.2em] shadow-black drop-shadow-xl uppercase text-center border-y-4 border-red-900 py-2 bg-black/80 backdrop-blur-md px-12 animate-shake-hard">
                    MONSTER ATTACK
                 </h2>
                 <p className="text-red-500 font-mono mt-2 bg-black/80 px-4 py-1">DEFEND OR DIE</p>
             </div>
         </div>
      )}

      {/* =========================================
          LEFT COLUMN (GAMEPLAY) - 75%
      ========================================= */}
      <div className="flex-[3] flex flex-col border-r border-gray-800 h-full relative">
         
         {/* NIGHT OVERLAY (Standard) */}
         {!isDay && !state.volcanoEventActive && !state.gasEventActive && !state.monsterEventActive && (
            <div className={`absolute inset-0 pointer-events-none z-0 mix-blend-overlay ${isVolcanoDay ? 'bg-red-900/40' : isGasDay ? 'bg-green-900/40' : 'bg-blue-900/10'}`}></div>
         )}
         
         {/* PRE-VOLCANO OVERLAY (Dynamic Ash) */}
         {isVolcanoDay && !state.volcanoEventActive && (
             <div className="absolute inset-0 pointer-events-none z-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] animate-pulse"></div>
         )}
         
         {/* PRE-GAS OVERLAY (Slight Haze) */}
         {isGasDay && !state.gasEventActive && (
             <div className="absolute inset-0 pointer-events-none z-0 bg-green-500/5 backdrop-blur-[1px] animate-pulse"></div>
         )}
         
         {/* PRE-MONSTER OVERLAY (Darkness) */}
         {isMonsterDay && !state.monsterEventActive && !isDay && (
             <div className="absolute inset-0 pointer-events-none z-0 bg-black/40 mix-blend-multiply"></div>
         )}

         {/* --- HEADER --- */}
         <header className="h-16 bg-black border-b border-gray-800 flex items-center justify-between px-6 shrink-0 z-20">
            <div className="flex items-center space-x-6">
              <h1 className="text-2xl font-bold tracking-tighter text-white">SP:24</h1>
              <div className="h-8 w-px bg-gray-800"></div>
              
              <div className="flex items-center space-x-3">
                {isDay ? <Sun className="text-yellow-500" size={20} /> : <Moon className="text-blue-500 animate-pulse" size={20} />}
                <span className={`text-2xl font-mono font-bold ${isDay ? 'text-yellow-100' : 'text-blue-100'}`}>
                  DAY {state.day}
                </span>
                
                {/* ACTIVE EVENT INDICATORS */}
                {isVolcanoDay && (
                  <div className="ml-2 flex items-center gap-1 bg-red-900/50 border border-red-500 px-2 py-0.5 rounded animate-pulse">
                     <Flame size={12} className="text-red-500" />
                     <span className="text-xs font-bold text-red-500 font-mono">ERUPTION IMMINENT</span>
                  </div>
                )}
                {isGasDay && (
                  <div className="ml-2 flex items-center gap-1 bg-green-900/50 border border-green-500 px-2 py-0.5 rounded animate-pulse">
                     <Biohazard size={12} className="text-green-500" />
                     <span className="text-xs font-bold text-green-500 font-mono">POISON GAS</span>
                  </div>
                )}
                {isZoneDay && (
                  <div className="ml-2 flex items-center gap-1 bg-red-900/80 border border-red-600 px-2 py-0.5 rounded animate-pulse">
                     <ShieldAlert size={12} className="text-white" />
                     <span className="text-xs font-bold text-white font-mono">ZONE SHRINK</span>
                  </div>
                )}
                {isMonsterDay && (
                  <div className="ml-2 flex items-center gap-1 bg-purple-900/50 border border-purple-500 px-2 py-0.5 rounded animate-pulse">
                     <Ghost size={12} className="text-purple-500" />
                     <span className="text-xs font-bold text-purple-500 font-mono">MONSTER HUNT</span>
                  </div>
                )}

                {/* WARNING INDICATORS (1 Day Prior) */}
                {isVolcanoWarning && (
                  <div className="ml-2 flex items-center gap-1 bg-yellow-900/30 border border-yellow-600 px-2 py-0.5 rounded">
                     <AlertTriangle size={12} className="text-yellow-500" />
                     <span className="text-xs font-bold text-yellow-500 font-mono">SEISMIC WARNING</span>
                  </div>
                )}
                {isGasWarning && (
                  <div className="ml-2 flex items-center gap-1 bg-yellow-900/30 border border-yellow-600 px-2 py-0.5 rounded">
                     <AlertTriangle size={12} className="text-yellow-500" />
                     <span className="text-xs font-bold text-yellow-500 font-mono">TOXIN WARNING</span>
                  </div>
                )}
              </div>

              <div className={`
                 flex items-center space-x-2 px-3 py-1 rounded-full font-mono font-bold text-sm border
                 ${isDay && state.timeLeft <= 10 ? 'bg-red-900/30 border-red-900 text-red-500 animate-pulse' : 'bg-gray-900 border-gray-800 text-gray-400'}
              `}>
                {isDay ? <Clock size={14} /> : <Eye size={14} />}
                <span>{isDay ? `00:${state.timeLeft.toString().padStart(2, '0')}` : (state.volcanoEventActive || state.gasEventActive || state.monsterEventActive) ? 'CRITICAL' : 'RESOLVING'}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
               <span className="text-xs text-gray-500 uppercase tracking-widest">Alive</span>
               <span className="text-3xl font-mono font-bold text-white">{aliveCount}<span className="text-gray-600 text-lg">/24</span></span>
            </div>
         </header>

         {/* --- PLAYER GRID --- */}
         <div className="flex-1 p-6 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 to-black relative">
            {/* Lock Grid during event */}
            {(state.volcanoEventActive || state.gasEventActive || state.monsterEventActive) && <div className="absolute inset-0 z-40 bg-transparent cursor-not-allowed"></div>}
            
            <div className="grid grid-cols-4 lg:grid-cols-6 gap-4 max-w-[1400px] mx-auto">
              {state.players.map(player => (
                <PlayerCard 
                  key={player.id} 
                  player={player} 
                  isMe={player.id === state.myPlayerId}
                  isSelected={pendingAction.targetId === player.id}
                  activeEvent={state.currentEvent}
                  onSelect={handlePlayerClick}
                  pendingActionType={player.id === state.myPlayerId ? pendingAction.type : undefined}
                  isVolcanoEvent={state.volcanoEventActive || state.gasEventActive || state.monsterEventActive}
                  isResolving={state.phase === Phase.NIGHT}
                />
              ))}
            </div>
         </div>

         {/* --- BOTTOM CONTROL PANEL --- */}
         <div className={`h-44 bg-black border-t border-gray-800 flex shrink-0 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] transition-opacity duration-500 ${(state.volcanoEventActive || state.gasEventActive || state.monsterEventActive) ? 'opacity-20 pointer-events-none grayscale' : 'opacity-100'}`}>
            
            {/* SELF STATUS (Left) */}
            <div className="w-64 p-4 border-r border-gray-800 flex flex-col justify-center gap-3 bg-gray-900/30">
               {me ? (
                 <>
                   <div className="flex items-end justify-between border-b border-gray-800 pb-2">
                      <span className="text-xs font-mono text-gray-500 uppercase">Integrity</span>
                      <div className="flex items-center gap-2 text-2xl font-bold text-white">
                         <Heart size={20} className="text-red-500" />
                         {me.hp}
                      </div>
                   </div>
                   <div className="space-y-2">
                      <div className="space-y-1">
                         <div className="flex justify-between text-[10px] text-gray-400 font-mono uppercase">
                            <span>Hunger</span>
                            <span>{me.hunger}</span>
                         </div>
                         <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full ${me.hunger < 30 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'} transition-all`} style={{ width: `${me.hunger}%` }}></div>
                         </div>
                      </div>
                      <div className="space-y-1">
                         <div className="flex justify-between text-[10px] text-gray-400 font-mono uppercase">
                            <span>Fatigue</span>
                            <span>{me.fatigue}</span>
                         </div>
                         <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full ${me.fatigue < 30 ? 'bg-red-500 animate-pulse' : 'bg-blue-500'} transition-all`} style={{ width: `${me.fatigue}%` }}></div>
                         </div>
                      </div>
                   </div>
                 </>
               ) : (
                 <div className="text-gray-600 text-center text-sm font-mono">SPECTATOR</div>
               )}
            </div>

            {/* ACTION CARDS (Center/Right) */}
            <div className="flex-1 p-4 flex items-center justify-start pl-8 overflow-x-auto">
               <ActionPanel 
                 player={me} 
                 phase={state.phase} 
                 day={state.day}
                 pendingAction={pendingAction} 
                 onActionSelect={(type) => onActionSelect(type, null)} 
                 onUseItem={onEquipItem}
               />
            </div>
         </div>
      </div>

      {/* =========================================
          RIGHT COLUMN (COMMS) - 25%
      ========================================= */}
      <div className={`flex-1 flex flex-col h-full bg-gray-950 min-w-[300px] max-w-[400px] transition-opacity duration-500 ${(state.volcanoEventActive || state.gasEventActive || state.monsterEventActive) ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
         
         {/* --- TOP-RIGHT EXIT HEADER --- */}
         <div className="h-16 bg-black border-b border-gray-800 flex items-center justify-end px-4 shrink-0">
             <button 
                onClick={() => setShowSurrenderModal(true)}
                disabled={me?.status === PlayerStatus.DEAD}
                className="flex items-center gap-2 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-500 px-3 py-1.5 rounded transition-all text-xs font-bold font-mono tracking-widest disabled:opacity-50 disabled:cursor-not-allowed group"
             >
                <LogOut size={14} className="group-hover:translate-x-0.5 transition-transform" />
                EXIT MATCH
             </button>
         </div>

         {/* CHAT (Top 60% minus header) */}
         <div className="flex-1 flex flex-col overflow-hidden">
            <ChatPanel 
               messages={state.messages} 
               players={state.players} 
               onSendMessage={onSendMessage} 
               myId={state.myPlayerId} 
            />
         </div>
         {/* LOG (Bottom 40%) */}
         <div className="h-[40%] flex flex-col border-t border-gray-800">
            <GameLog logs={state.logs} myPlayerId={state.myPlayerId} />
         </div>
      </div>
    </div>
  );
};

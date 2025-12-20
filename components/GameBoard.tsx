
import React, { useState, useEffect, useRef } from 'react';
import { GameState, ActionType, Phase, PlayerStatus } from '../types';
import { PlayerCard } from './PlayerCard';
import { ActionPanel } from './ActionPanel';
import { GameLog } from './GameLog';
import { ChatPanel } from './ChatPanel';
import { BattleAnimationLayer } from './BattleAnimationLayer';
import { GlobalModal } from './GlobalModal';
import { AdminPanel } from './AdminPanel';
import { SettingsModal } from './SettingsModal';
import { Clock, Sun, Moon, Eye, Heart, Skull, Loader, Flame, Biohazard, ShieldAlert, Ghost, AlertTriangle, LogOut, Trophy, Settings, X, MessageSquare, Wrench } from 'lucide-react';

interface GameBoardProps {
  state: GameState;
  pendingAction: { type: ActionType, targetId?: string | null };
  onActionSelect: (type: ActionType, targetId?: string) => void;
  onSendMessage: (text: string, recipient?: string) => void;
  onEquipItem: (item: string) => void;
  onLeaveGame: () => void;
  onSurrender: () => void;
  onCloseModal?: () => void;
  onCloseWarning?: () => void;
  onClaimVictory?: () => void;
  adminSetDay?: (d: number) => void;
  adminTriggerEvent?: (t: string) => void;
  adminKillPlayer?: (id: string) => void;
  adminToggleNoCost?: () => void;
  adminWinGame?: () => void;
}

const WarningOverlay: React.FC<{ 
  title: string; 
  subtitle: string; 
  theme: 'ACID' | 'VOLCANO' | 'ZONE' | 'MONSTER';
  onDismiss: () => void;
}> = ({ title, subtitle, theme, onDismiss }) => {
  let borderColor = "border-gray-700";
  let accentColor = "bg-red-600";

  switch (theme) {
    case 'ACID': borderColor = "border-green-900"; accentColor = "bg-green-500"; break;
    case 'VOLCANO': borderColor = "border-orange-900"; accentColor = "bg-orange-500"; break;
    case 'MONSTER': borderColor = "border-purple-900"; accentColor = "bg-purple-500"; break;
    case 'ZONE': borderColor = "border-red-900"; accentColor = "bg-red-600"; break;
  }

  return (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-8 cursor-pointer pointer-events-auto"
      onClick={onDismiss}
    >
      <div 
        className={`max-w-lg w-full bg-gray-950 border ${borderColor} rounded-lg shadow-2xl overflow-hidden relative transform transition-all scale-100 animate-in fade-in zoom-in-95 duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onDismiss} className="absolute top-2 right-2 text-gray-700 hover:text-gray-400">
          <X size={20} />
        </button>
        <div className="p-10 text-center">
          <h2 className="text-4xl font-bold font-mono text-white mb-4 tracking-tighter uppercase">{title}</h2>
          <div className={`w-20 h-1.5 ${accentColor} mx-auto mb-8 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.2)]`}></div>
          <p className="text-gray-200 text-xl font-mono leading-relaxed whitespace-pre-line px-4">{subtitle}</p>
        </div>
        <div className="bg-black/50 p-3 text-center border-t border-gray-800">
          <p className="text-[10px] text-gray-600 font-mono tracking-widest uppercase">TAP ANYWHERE TO DISMISS</p>
        </div>
      </div>
    </div>
  );
};

const ActiveEventBar: React.FC<{ 
  title: string; 
  subtitle: string; 
  theme: 'ACID' | 'VOLCANO' | 'ZONE' | 'MONSTER';
}> = ({ title, subtitle, theme }) => {
  let textColor = "text-green-500";
  let glowColor = "shadow-green-500/50";
  let textGlow = "drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]";

  switch (theme) {
    case 'VOLCANO':
      textColor = "text-orange-500";
      glowColor = "shadow-orange-500/50";
      textGlow = "drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]";
      break;
    case 'ZONE':
      textColor = "text-red-600";
      glowColor = "shadow-red-600/50";
      textGlow = "drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]";
      break;
    case 'MONSTER':
      textColor = "text-purple-500";
      glowColor = "shadow-purple-500/50";
      textGlow = "drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]";
      break;
  }

  return (
    <div className="fixed top-1/3 left-0 right-0 z-[10000] flex flex-col items-center pointer-events-none animate-in fade-in slide-in-from-top-4 duration-500">
      <div className={`w-full max-w-4xl bg-black border-y-2 border-gray-900 py-6 flex items-center justify-center shadow-2xl ${glowColor}`}>
        <h1 className={`text-4xl md:text-6xl lg:text-8xl font-black font-mono tracking-[0.15em] uppercase ${textColor} ${textGlow} text-center`}>
          {title}
        </h1>
      </div>
      <div className="mt-4 bg-black border border-gray-800 px-10 py-2 shadow-xl">
        <span className={`text-lg md:text-xl font-bold font-mono tracking-[0.3em] uppercase ${textColor} text-center block`}>
          {subtitle}
        </span>
      </div>
    </div>
  );
};

const CrackedScreenOverlay = () => (
  <div className="absolute inset-0 z-[200] pointer-events-none mix-blend-overlay opacity-80 overflow-hidden">
    <svg width="100%" height="100%" preserveAspectRatio="none" className="absolute inset-0">
      <defs>
        <filter id="displacement" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="turbulence" baseFrequency="0.01" numOctaves="3" result="turbulence" />
          <feDisplacementMap in2="turbulence" in="SourceGraphic" scale="20" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <path d="M0,0 L150,80 L80,150 L0,200 Z" fill="white" fillOpacity="0.1" />
      <path d="M0,0 L120,60 L60,120" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" />
      <path d="M100%,0 Lcalc(100% - 150px),80 Lcalc(100% - 80px),150 L100%,200 Z" fill="white" fillOpacity="0.1" />
      <path d="M100%,0 Lcalc(100% - 120px),60 Lcalc(100% - 60px),120" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" />
      <path d="M0,100% L150,calc(100% - 80px) L80,calc(100% - 150px) L0,calc(100% - 200px) Z" fill="white" fillOpacity="0.1" />
      <path d="M0,100% L120,calc(100% - 60px) L60,calc(100% - 120px)" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" />
      <path d="M100%,100% Lcalc(100% - 150px),calc(100% - 80px) Lcalc(100% - 80px),calc(100% - 150px) L100%,calc(100% - 200px) Z" fill="white" fillOpacity="0.1" />
      <path d="M100%,100% Lcalc(100% - 120px),calc(100% - 60px) Lcalc(100% - 60px),calc(100% - 120px)" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" />
    </svg>
  </div>
);

export const GameBoard: React.FC<GameBoardProps> = ({ 
  state, 
  pendingAction, 
  onActionSelect,
  onSendMessage,
  onEquipItem,
  onLeaveGame,
  onSurrender,
  onCloseModal,
  onCloseWarning,
  onClaimVictory,
  adminSetDay,
  adminTriggerEvent,
  adminKillPlayer,
  adminToggleNoCost,
  adminWinGame
}) => {
  const me = state.players.find(p => p.id === state.myPlayerId);
  const isDay = state.phase === Phase.DAY;
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [hasShownDeath, setHasShownDeath] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showSurrenderModal, setShowSurrenderModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cleanupTimer, setCleanupTimer] = useState(45);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const isWinner = state.phase === Phase.GAME_OVER && state.winnerId === state.myPlayerId;

  const gridContainerRef = useRef<HTMLDivElement>(null);

  // REFINED AUTO-SCROLL EFFECT
  useEffect(() => {
    if (state.currentEvent && state.currentEvent.sourceId !== 'ENVIRONMENT') {
        const isInteraction = [ActionType.ATTACK, ActionType.SHOOT, ActionType.HEAL].includes(state.currentEvent.type as ActionType);
        const targetId = (isInteraction && state.currentEvent.targetId) 
          ? state.currentEvent.targetId 
          : state.currentEvent.sourceId;

        const el = document.getElementById(`player-card-${targetId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
    }
  }, [state.currentEvent]);

  useEffect(() => {
    if (state.phase === Phase.GAME_OVER) {
       const timer = setInterval(() => { setCleanupTimer(prev => Math.max(0, prev - 1)); }, 1000);
       return () => clearInterval(timer);
    }
  }, [state.phase]);

  useEffect(() => {
     if (me?.status === PlayerStatus.DEAD && state.phase !== Phase.GAME_OVER && !isLeaving && !hasShownDeath) {
        const timer = setTimeout(() => { setShowDeathModal(true); setHasShownDeath(true); }, 2000);
        return () => clearTimeout(timer);
     }
  }, [me?.status, state.phase, isLeaving, hasShownDeath]);

  const handlePlayerClick = (targetId: string) => {
    if (state.volcanoEventActive || state.gasEventActive || state.monsterEventActive || state.zoneShrinkActive) return;
    if (pendingAction.type === ActionType.ATTACK || pendingAction.type === ActionType.SHOOT || pendingAction.type === ActionType.HEAL) {
      onActionSelect(pendingAction.type, targetId);
    }
  };

  const handleLeave = () => { setIsLeaving(true); setShowDeathModal(false); setTimeout(() => { onLeaveGame(); }, 1000); };
  const handleSurrenderConfirm = () => { setIsLeaving(true); setShowSurrenderModal(false); setTimeout(() => { onSurrender(); }, 1000); };
  const handleClaim = () => { setIsLeaving(true); if (onClaimVictory) onClaimVictory(); else onLeaveGame(); };

  const aliveCount = state.players.filter(p => p.status === 'ALIVE').length;
  const isVolcanoDay = state.day === state.volcanoDay;
  const isGasDay = state.day === state.gasDay;
  const isZoneDay = state.day === 20 || state.day === 30 || state.day === 45;
  const isMonsterDay = state.day === state.nextMonsterDay;
  const isDead = me?.status === PlayerStatus.DEAD;
  const zoneLevel = state.day >= 45 ? 3 : state.day >= 30 ? 2 : state.day >= 20 ? 1 : 0;
  const showCracks = zoneLevel >= 3;

  return (
    <div className={`h-screen w-full flex flex-col lg:flex-row bg-black text-gray-200 overflow-hidden font-rajdhani relative ${isVolcanoDay && !isDay && !state.volcanoEventActive ? 'animate-shake' : ''} ${state.volcanoEventActive ? 'animate-shake-hard' : ''} ${state.gasEventActive ? 'animate-sway' : ''} ${state.monsterEventActive ? 'animate-shake' : ''}`}>
      <BattleAnimationLayer event={state.currentEvent} />
      
      <GlobalModal 
        isOpen={state.modal.isOpen} 
        title={state.modal.title} 
        message={state.modal.message} 
        onClose={() => onCloseModal && onCloseModal()} 
      />

      <SettingsModal 
         isOpen={showSettings}
         onClose={() => setShowSettings(false)}
         playerStatus={me?.status || PlayerStatus.ALIVE}
         onExit={handleLeave}
         onSurrender={() => setShowSurrenderModal(true)}
      />

      {state.isPractice && (
          <AdminPanel 
             isOpen={showAdminPanel}
             onClose={() => setShowAdminPanel(false)}
             players={state.players}
             day={state.day}
             adminNoCost={!!state.adminNoCost}
             onSetDay={adminSetDay!}
             onForceEvent={adminTriggerEvent!}
             onKillPlayer={adminKillPlayer!}
             onToggleNoCost={adminToggleNoCost!}
             onSimulateWin={adminWinGame!}
          />
      )}

      {/* MOBILE CHAT OVERLAY (SIDE-BY-SIDE) */}
      {showMobileChat && (
        <div className="fixed inset-0 z-[150] bg-black/95 flex flex-col lg:hidden animate-fade-in px-2 pt-2 pb-4">
            <div className="h-10 border-b border-gray-800 flex items-center justify-between px-2 shrink-0">
                <div className="flex gap-2 text-xs font-mono text-gray-400">
                    <span className="text-yellow-500 font-bold">COMMS</span>
                    <span>//</span>
                    <span className="text-blue-400 font-bold">LOGS</span>
                </div>
                <button onClick={() => setShowMobileChat(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex-1 flex flex-row gap-2 mt-2 overflow-hidden">
                <div className="flex-1 border border-gray-800 rounded bg-gray-950/50 overflow-hidden">
                    <ChatPanel messages={state.messages} players={state.players} onSendMessage={onSendMessage} myId={state.myPlayerId} />
                </div>
                <div className="flex-1 border border-gray-800 rounded bg-gray-950/50 overflow-hidden">
                    <GameLog logs={state.logs} myPlayerId={state.myPlayerId} />
                </div>
            </div>
        </div>
      )}

      {/* VICTORY/DEATH/SURRENDER MODALS ... (No change) */}
      {isWinner && (
         <div className="absolute inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center animate-fade-in">
             <div className="text-center">
                 <Trophy size={96} className="text-yellow-500 mx-auto mb-6 animate-bounce drop-shadow-[0_0_50px_rgba(234,179,8,0.8)]" />
                 <h1 className="text-6xl font-black text-white tracking-tighter uppercase mb-2">VICTORY</h1>
                 <p className="text-xl text-yellow-500 font-mono tracking-widest mb-8">SURVIVOR: {me?.name}</p>
                 <div className="bg-gray-900 border border-gray-700 p-8 rounded-xl max-w-md mx-auto shadow-2xl relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500 animate-[loading_45s_linear]"></div>
                     <p className="text-gray-400 font-mono text-sm mb-6">Protocol complete. You have successfully eliminated all threats.<br/><br/><span className="text-red-500">Auto-Termination in {cleanupTimer}s</span></p>
                     <button onClick={handleClaim} className="w-full py-4 bg-yellow-600 hover:bg-yellow-700 text-black font-bold font-mono tracking-[0.2em] rounded shadow-lg shadow-yellow-900/50 uppercase transition-all hover:scale-105">CLAIM REWARD & EXIT</button>
                 </div>
             </div>
         </div>
      )}

      {showSurrenderModal && !isWinner && (
         <div className="absolute inset-0 z-[180] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-fade-in">
           <div className="max-w-md w-full bg-gray-900 border border-gray-800 p-8 rounded-lg text-center shadow-2xl relative">
              <AlertTriangle size={48} className="text-red-500 mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-tighter">CONFIRM SURRENDER</h2>
              <p className="text-gray-400 mb-6 font-mono text-sm leading-relaxed">Are you sure you want to abandon the match?<br/><span className="text-red-500 font-bold">All stats gained will be lost.</span><br/>This action is irreversible.</p>
              <div className="flex gap-3">
                 <button onClick={() => setShowSurrenderModal(false)} className="flex-1 py-3 bg-transparent border border-gray-600 text-white font-mono hover:bg-gray-800 transition-colors uppercase tracking-widest">CANCEL</button>
                 <button onClick={handleSurrenderConfirm} className="flex-1 py-3 bg-red-700 text-white font-mono hover:bg-red-800 transition-colors uppercase tracking-widest shadow-lg shadow-red-900/20">SURRENDER</button>
              </div>
           </div>
        </div>
      )}

      {showDeathModal && !isLeaving && !showSurrenderModal && !isWinner && (
        <div className="absolute inset-0 z-[160] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-fade-in">
           <div className="max-w-md w-full bg-gray-900 border border-gray-800 p-8 rounded-lg text-center shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
               <Skull size={48} className="text-red-600 mx-auto mb-4 animate-pulse" />
               <h2 className="text-4xl font-bold text-white mb-2 uppercase tracking-tighter">You Are Dead</h2>
               <p className="text-gray-400 mb-8 font-mono">Your journey ends here.<br/>What do you want to do?</p>
               <div className="space-y-3">
                  <button onClick={() => setShowDeathModal(false)} className="w-full py-3 bg-transparent border border-gray-600 text-white font-mono hover:bg-gray-800 transition-colors uppercase tracking-widest">Watch Game (Spectator)</button>
                  <button onClick={handleLeave} className="w-full py-3 bg-red-700 text-white font-mono hover:bg-red-800 transition-colors uppercase tracking-widest shadow-lg shadow-red-900/20">Leave Game</button>
               </div>
           </div>
        </div>
      )}

      {isLeaving && (
         <div className="absolute inset-0 z-[220] bg-black flex flex-col items-center justify-center">
            <Loader className="text-white animate-spin mb-4" size={32} />
            <p className="text-gray-400 font-mono tracking-widest animate-pulse">TERMINATING SESSION...</p>
         </div>
      )}
      
      {zoneLevel > 0 && (
         <div className="absolute inset-0 z-[100] pointer-events-none overflow-hidden">
             <div className="absolute inset-0 transition-all duration-1000" style={{ boxShadow: `inset 0 0 ${Math.min(zoneLevel, 2) * 100}px ${Math.min(zoneLevel, 2) * 50}px rgba(0,0,0,${0.5 + Math.min(zoneLevel, 2) * 0.15})` }}></div>
             {showCracks && <CrackedScreenOverlay />}
         </div>
      )}

      {state.activeWarning && (
         <WarningOverlay 
            title={state.activeWarning.title} 
            subtitle={state.activeWarning.subtitle} 
            theme={state.activeWarning.theme} 
            onDismiss={() => onCloseWarning ? onCloseWarning() : (onCloseModal && onCloseModal())}
         />
      )}

      {state.zoneShrinkActive && (
         <>
            <div className="absolute inset-0 z-[9998] pointer-events-none flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 animate-vignette-squeeze bg-transparent"></div>
                <div className="absolute inset-0 bg-transparent animate-crack-grow border-4 border-black/80 mix-blend-multiply"></div>
            </div>
            <ActiveEventBar title="ZONE COLLAPSE" subtitle="PERIMETER BREACHED" theme="ZONE" />
         </>
      )}

      {state.volcanoEventActive && (
         <>
            <div className="absolute inset-0 z-[9998] pointer-events-none overflow-hidden bg-red-900/30 mix-blend-multiply">
                <div className="absolute inset-0 backdrop-blur-[4px] animate-pulse"></div>
                <div className="absolute inset-0 w-full h-full animate-ash bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-repeat opacity-80"></div>
                <div className="absolute inset-0 bg-red-600/20 animate-volcano-flash mix-blend-color-dodge"></div>
            </div>
            <ActiveEventBar title="ERUPTION" subtitle="CONTAINMENT FAILURE" theme="VOLCANO" />
         </>
      )}

      {state.monsterEventActive && (
         <>
            <div className="absolute inset-0 z-[9998] pointer-events-none overflow-hidden bg-black/85 mix-blend-multiply">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_transparent_10%,_black_100%)]"></div>
            </div>
            <ActiveEventBar title="MONSTER HUNT" subtitle="SURVIVAL MANDATORY" theme="MONSTER" />
         </>
      )}

      {state.gasEventActive && (
         <>
            <div className="absolute inset-0 z-[9998] pointer-events-none overflow-hidden">
                <div className="absolute inset-0 animate-gas-drift mix-blend-overlay opacity-90"></div>
                <div className="absolute inset-0 animate-toxic bg-green-900/20"></div>
                <div className="bg-noise opacity-30"></div>
            </div>
            <ActiveEventBar title="ACID STORM" subtitle="TOXICITY CRITICAL" theme="ACID" />
         </>
      )}

      {/* MAIN GAME AREA */}
      <div className="flex-1 lg:flex-[3] flex flex-col border-r-0 lg:border-r border-gray-800 h-full relative overflow-hidden">
         {!isDay && !state.volcanoEventActive && !state.gasEventActive && !state.monsterEventActive && !state.zoneShrinkActive && (
            <div className={`absolute inset-0 pointer-events-none z-0 mix-blend-overlay ${isVolcanoDay ? 'bg-red-900/40' : isGasDay ? 'bg-green-900/40' : 'bg-blue-900/10'}`}></div>
         )}
         {isVolcanoDay && !state.volcanoEventActive && (
             <div className="absolute inset-0 pointer-events-none z-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] animate-pulse"></div>
         )}
         {isGasDay && !state.gasEventActive && (
             <div className="absolute inset-0 pointer-events-none z-0 bg-green-500/5 backdrop-blur-[1px] animate-pulse"></div>
         )}
         {isMonsterDay && !state.monsterEventActive && !isDay && (
             <div className="absolute inset-0 pointer-events-none z-0 bg-black/40 mix-blend-multiply"></div>
         )}

         {/* TOP BAR */}
         <header className="h-14 lg:h-16 bg-black border-b border-gray-800 flex items-center justify-between px-3 lg:px-6 shrink-0 z-20">
            <div className="flex items-center space-x-2 lg:space-x-6">
              <h1 className="text-lg lg:text-2xl font-bold tracking-tighter text-white">SP:24</h1>
              <div className="hidden lg:block h-8 w-px bg-gray-800"></div>
              <div className="flex items-center space-x-2 lg:space-x-3">
                {isDay ? <Sun className="text-yellow-500" size={18} /> : <Moon className="text-blue-500 animate-pulse" size={18} />}
                <span className={`text-base lg:text-2xl font-mono font-bold ${isDay ? 'text-yellow-100' : 'text-blue-100'}`}>DAY {state.day}</span>
                <div className="hidden sm:flex items-center">
                    {/* Event Icons (Desktop) */}
                    {isVolcanoDay && <Flame size={12} className="text-red-500" />}
                    {isGasDay && <Biohazard size={12} className="text-green-500" />}
                    {isZoneDay && <ShieldAlert size={12} className="text-white" />}
                    {isMonsterDay && <Ghost size={12} className="text-purple-500" />}
                </div>
              </div>
              <div className={`flex items-center space-x-2 px-2 lg:px-3 py-1 rounded-full font-mono font-bold text-xs lg:text-sm border ${isDay && state.timeLeft <= 10 ? 'bg-red-900/30 border-red-900 text-red-500 animate-pulse' : 'bg-gray-900 border-gray-800 text-gray-400'}`}>
                {isDay ? <Clock size={12} /> : <Eye size={12} />}
                <span>{isDay ? `00:${state.timeLeft.toString().padStart(2, '0')}` : (state.volcanoEventActive || state.gasEventActive || state.monsterEventActive || state.zoneShrinkActive) ? 'CRITICAL' : 'RESOLVING'}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2 lg:space-x-4">
               {/* Mobile Admin Button (Practice Only) */}
               {state.isPractice && (
                   <button 
                      onClick={() => setShowAdminPanel(true)} 
                      className="lg:hidden p-2 bg-gray-900 hover:bg-gray-800 border border-yellow-700/50 text-yellow-500 rounded transition-colors"
                   >
                      <Wrench size={18} />
                   </button>
               )}

               {/* Mobile Chat Toggle Button */}
               <button onClick={() => setShowMobileChat(true)} className="lg:hidden p-2 text-gray-400 bg-gray-900 border border-gray-700 rounded relative hover:text-white transition-colors">
                  <MessageSquare size={18} />
                  {state.messages.length > 0 && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-gray-900"></div>}
               </button>

               <button onClick={() => setShowSettings(true)} className="p-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-400 hover:text-white rounded transition-colors"><Settings size={18} /></button>
               <div className="hidden sm:flex items-center space-x-2"><span className="text-xs text-gray-500 uppercase tracking-widest">Alive</span><span className="text-3xl font-mono font-bold text-white">{aliveCount}<span className="text-gray-600 text-lg">/24</span></span></div>
               <div className="sm:hidden text-xs font-mono text-gray-500">{aliveCount}/24</div>
            </div>
         </header>

         <div 
           ref={gridContainerRef}
           className="flex-1 p-1 lg:p-6 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 to-black relative custom-scrollbar pb-32 lg:pb-6"
         >
            {(state.volcanoEventActive || state.gasEventActive || state.monsterEventActive || state.zoneShrinkActive) && <div className="absolute inset-0 z-40 bg-transparent cursor-not-allowed"></div>}
            {/* GRID LAYOUT: Strict 4 columns on all sizes */}
            <div className="grid grid-cols-4 gap-1 lg:gap-4 max-w-[1400px] mx-auto">
              {state.players.map(player => (
                <PlayerCard 
                  key={player.id} player={player} isMe={player.id === state.myPlayerId} isSelected={pendingAction.targetId === player.id} activeEvent={state.currentEvent} onSelect={handlePlayerClick}
                  pendingActionType={player.id === state.myPlayerId ? pendingAction.type : undefined} isVolcanoEvent={state.volcanoEventActive || state.gasEventActive || state.monsterEventActive || state.zoneShrinkActive} isResolving={state.phase === Phase.NIGHT}
                />
              ))}
            </div>
         </div>

         <div className={`h-auto lg:h-44 bg-black border-t border-gray-800 flex flex-col lg:flex-row shrink-0 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] transition-opacity duration-500 ${(state.volcanoEventActive || state.gasEventActive || state.monsterEventActive || state.zoneShrinkActive) ? 'opacity-20 pointer-events-none grayscale' : 'opacity-100'}`}>
            <div className="w-full lg:w-64 p-2 lg:p-4 border-b lg:border-b-0 lg:border-r border-gray-800 flex flex-row lg:flex-col justify-between items-center lg:justify-center gap-3 bg-gray-900/30">
               {me ? (
                 <>
                   <div className="flex items-center gap-4 lg:gap-0 lg:w-full lg:items-end lg:justify-between lg:border-b lg:border-gray-800 lg:pb-2">
                       <span className="hidden lg:inline text-xs font-mono text-gray-500 uppercase">Integrity</span>
                       <div className="flex items-center gap-2 text-lg lg:text-2xl font-bold text-white"><Heart size={18} className="text-red-500 lg:w-5 lg:h-5" />{me.hp}</div>
                   </div>
                   {/* Stats */}
                   <div className="flex-1 lg:w-full space-y-0 lg:space-y-2 flex lg:block gap-4">
                      <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-[9px] lg:text-[10px] text-gray-400 font-mono uppercase"><span>Hunger</span><span>{me.hunger}</span></div>
                          <div className="h-1 lg:h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className={`h-full ${me.hunger < 30 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'} transition-all`} style={{ width: `${me.hunger}%` }}></div></div>
                      </div>
                      <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-[9px] lg:text-[10px] text-gray-400 font-mono uppercase"><span>Fatigue</span><span>{me.fatigue}</span></div>
                          <div className="h-1 lg:h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className={`h-full ${me.fatigue < 30 ? 'bg-red-500 animate-pulse' : 'bg-blue-500'} transition-all`} style={{ width: `${me.fatigue}%` }}></div></div>
                      </div>
                   </div>
                 </>
               ) : (
                 <div className="text-gray-600 text-center text-sm font-mono">SPECTATOR</div>
               )}
            </div>
            <div className="flex-1 p-1 lg:p-4 flex items-center justify-start lg:pl-8 overflow-x-auto h-28 lg:h-auto scrollbar-hide">
               <ActionPanel player={me} phase={state.phase} day={state.day} pendingAction={pendingAction} onActionSelect={(type) => onActionSelect(type, null)} onUseItem={onEquipItem} adminNoCost={state.adminNoCost} />
            </div>
         </div>
      </div>

      {/* RIGHT SIDEBAR (Desktop Only) */}
      <div className={`hidden lg:flex flex-1 flex-col h-full bg-gray-950 min-w-[300px] max-w-[400px] transition-opacity duration-500 ${(state.volcanoEventActive || state.gasEventActive || state.monsterEventActive || state.zoneShrinkActive) ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
         <div className="h-16 bg-black border-b border-gray-800 flex items-center justify-end px-4 shrink-0 gap-3">
             {state.isPractice && (<button onClick={() => setShowAdminPanel(true)} className="flex items-center gap-2 bg-yellow-900/20 hover:bg-yellow-900/40 border border-yellow-700/50 text-yellow-500 px-3 py-1.5 rounded transition-all text-xs font-bold font-mono tracking-widest group"><Settings size={14} className="group-hover:rotate-90 transition-transform" />ADMIN</button>)}
             {isDead ? (<button onClick={handleLeave} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 px-3 py-1.5 rounded transition-all text-xs font-bold font-mono tracking-widest group"><LogOut size={14} className="group-hover:translate-x-0.5 transition-transform" />EXIT MATCH</button>) : (<button onClick={() => setShowSurrenderModal(true)} disabled={isWinner} className="flex items-center gap-2 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-500 px-3 py-1.5 rounded transition-all text-xs font-bold font-mono tracking-widest disabled:opacity-50 disabled:cursor-not-allowed group"><AlertTriangle size={14} className="group-hover:translate-x-0.5 transition-transform" />SURRENDER</button>)}
         </div>
         <div className="flex-1 flex flex-col overflow-hidden"><ChatPanel messages={state.messages} players={state.players} onSendMessage={onSendMessage} myId={state.myPlayerId} /></div>
         <div className="h-[40%] flex flex-col border-t border-gray-800"><GameLog logs={state.logs} myPlayerId={state.myPlayerId} /></div>
      </div>
    </div>
  );
};

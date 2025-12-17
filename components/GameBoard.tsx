
import React, { useState, useEffect } from 'react';
import { GameState, ActionType, Phase, PlayerStatus } from '../types';
import { PlayerCard } from './PlayerCard';
import { ActionPanel } from './ActionPanel';
import { GameLog } from './GameLog';
import { ChatPanel } from './ChatPanel';
import { BattleAnimationLayer } from './BattleAnimationLayer';
import { GlobalModal } from './GlobalModal';
import { AdminPanel } from './AdminPanel';
import { SettingsModal } from './SettingsModal';
import { Clock, Sun, Moon, Eye, Heart, Skull, Loader, Flame, Biohazard, ShieldAlert, Ghost, AlertTriangle, LogOut, Trophy, Settings } from 'lucide-react';

interface GameBoardProps {
  state: GameState;
  pendingAction: { type: ActionType, targetId?: string | null };
  onActionSelect: (type: ActionType, targetId?: string) => void;
  onSendMessage: (text: string, recipient?: string) => void;
  onEquipItem: (item: string) => void;
  onLeaveGame: () => void;
  onSurrender: () => void;
  onCloseModal?: () => void;
  onClaimVictory?: () => void;
  // Admin Props
  adminSetDay?: (d: number) => void;
  adminTriggerEvent?: (t: string) => void;
  adminKillPlayer?: (id: string) => void;
  adminToggleNoCost?: () => void;
  adminWinGame?: () => void;
}

// STRICT NOTIFICATION STYLE COMPONENT
// NO SCALING, NO BOUNCE, NO ZOOM. ONLY FADE.
const EventTitleOverlay: React.FC<{ 
  title: string; 
  subtitle: string; 
  theme: 'ACID' | 'VOLCANO' | 'ZONE' | 'MONSTER';
}> = ({ title, subtitle, theme }) => {
  
  // Base Layout: Matches Acid Storm screenshot structure exactly
  // Container: Dark bar, borders top/bottom
  // Title: Large, heavy font, tracking tight
  // Sub: Boxed, mono, tracking wide
  
  const containerBase = "w-full max-w-5xl bg-black/95 border-y-4 py-10 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden backdrop-blur-sm";
  const titleBase = "text-6xl md:text-9xl font-black tracking-tighter uppercase text-center font-mono leading-none z-10 whitespace-nowrap";
  const subBase = "font-mono text-sm md:text-xl tracking-[0.5em] uppercase font-bold px-6 py-2 z-10 mt-6 border border-opacity-50 bg-opacity-20";

  let themeClasses = {
    container: "",
    title: "",
    sub: "",
    overlay: "" // Internal atmospheric glow
  };

  switch (theme) {
    case 'ACID':
      themeClasses = {
        container: "border-green-600 shadow-green-900/50",
        title: "text-green-500 drop-shadow-[0_0_25px_rgba(34,197,94,0.6)]",
        sub: "text-green-500 border-green-500 bg-green-900",
        overlay: "bg-green-500/5"
      };
      break;
    case 'VOLCANO':
      themeClasses = {
        container: "border-orange-700 shadow-red-900/50", // Adjusted for visibility
        title: "text-orange-500 drop-shadow-[0_0_30px_rgba(220,38,38,0.8)]", // Brighter Orange/Red
        sub: "text-orange-400 border-orange-600 bg-red-900/50",
        overlay: "bg-red-900/20"
      };
      break;
    case 'ZONE':
      themeClasses = {
        container: "border-fuchsia-900 shadow-purple-900/50", 
        title: "text-fuchsia-600 drop-shadow-[0_0_15px_rgba(162,28,175,0.4)]",
        sub: "text-fuchsia-400 border-fuchsia-800 bg-fuchsia-900",
        overlay: "bg-fuchsia-900/5"
      };
      break;
    case 'MONSTER':
      themeClasses = {
        container: "border-red-900 shadow-black", 
        title: "text-red-600 drop-shadow-[0_0_15px_rgba(153,27,27,0.8)]", // Brighter Red (Blood)
        sub: "text-red-500 border-red-800 bg-black",
        overlay: "bg-red-950/20"
      };
      break;
  }

  return (
    <div className="absolute top-[25%] left-0 right-0 flex justify-center z-[10000] pointer-events-none animate-in fade-in duration-500">
       <div className={`${containerBase} ${themeClasses.container}`}>
           <div className={`absolute inset-0 ${themeClasses.overlay}`}></div>
           <h1 className={`${titleBase} ${themeClasses.title}`}>{title}</h1>
           <div className={`${subBase} ${themeClasses.sub}`}>
              {subtitle}
           </div>
       </div>
    </div>
  );
};

// Cracked Screen Overlay for Phase 3
const CrackedScreenOverlay = () => (
  <div className="absolute inset-0 z-[200] pointer-events-none mix-blend-overlay opacity-80 overflow-hidden">
    <svg width="100%" height="100%" preserveAspectRatio="none" className="absolute inset-0">
      <defs>
        <filter id="displacement" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="turbulence" baseFrequency="0.01" numOctaves="3" result="turbulence" />
          <feDisplacementMap in2="turbulence" in="SourceGraphic" scale="20" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      {/* Corner Cracks */}
      <path d="M0,0 L150,80 L80,150 L0,200 Z" fill="white" fillOpacity="0.1" />
      <path d="M0,0 L120,60 L60,120" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" />
      
      <path d="M100%,0 Lcalc(100% - 150px),80 Lcalc(100% - 80px),150 L100%,200 Z" fill="white" fillOpacity="0.1" />
      <path d="M100%,0 Lcalc(100% - 120px),60 Lcalc(100% - 60px),120" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" />

      <path d="M0,100% L150,calc(100% - 80px) L80,calc(100% - 150px) L0,calc(100% - 200px) Z" fill="white" fillOpacity="0.1" />
      <path d="M0,100% L120,calc(100% - 60px) L60,calc(100% - 120px)" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" />

      <path d="M100%,100% Lcalc(100% - 150px),calc(100% - 80px) Lcalc(100% - 80px),calc(100% - 150px) L100%,calc(100% - 200px) Z" fill="white" fillOpacity="0.1" />
      <path d="M100%,100% Lcalc(100% - 120px),calc(100% - 60px) Lcalc(100% - 60px),calc(100% - 120px)" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" />
      
      {/* Random fissures */}
      <path d="M20%,0 L25%,15% M25%,15% L22%,25% M25%,15% L30%,20%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none" />
      <path d="M80%,100% L75%,85% M75%,85% L78%,75% M75%,85% L70%,80%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none" />
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
  
  // Victory State
  const [cleanupTimer, setCleanupTimer] = useState(45);
  const isWinner = state.phase === Phase.GAME_OVER && state.winnerId === state.myPlayerId;

  // Cleanup Countdown
  useEffect(() => {
    if (state.phase === Phase.GAME_OVER) {
       const timer = setInterval(() => {
           setCleanupTimer(prev => Math.max(0, prev - 1));
       }, 1000);
       return () => clearInterval(timer);
    }
  }, [state.phase]);

  useEffect(() => {
     if (me?.status === PlayerStatus.DEAD && state.phase !== Phase.GAME_OVER && !isLeaving && !hasShownDeath) {
        const timer = setTimeout(() => {
           setShowDeathModal(true);
           setHasShownDeath(true);
        }, 2000);
        return () => clearTimeout(timer);
     }
  }, [me?.status, state.phase, isLeaving, hasShownDeath]);

  const handlePlayerClick = (targetId: string) => {
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
  
  const handleClaim = () => {
      setIsLeaving(true);
      if (onClaimVictory) onClaimVictory();
      else onLeaveGame();
  };

  const aliveCount = state.players.filter(p => p.status === 'ALIVE').length;
  const isVolcanoDay = state.day === state.volcanoDay;
  const isGasDay = state.day === state.gasDay;
  const isZoneDay = state.day === 20 || state.day === 30 || state.day === 45;
  const isMonsterDay = state.day === state.nextMonsterDay;

  const isVolcanoWarning = state.day === state.volcanoDay - 1;
  const isGasWarning = state.day === state.gasDay - 1;

  const isDead = me?.status === PlayerStatus.DEAD;

  // Derived Zone Intensity for persistent effects
  const zoneLevel = state.day >= 45 ? 3 : state.day >= 30 ? 2 : state.day >= 20 ? 1 : 0;
  
  // Phase 3 Crack Logic
  const showCracks = zoneLevel >= 3;

  return (
    <div className={`h-screen w-full flex bg-black text-gray-200 overflow-hidden font-rajdhani relative ${isVolcanoDay && !isDay && !state.volcanoEventActive ? 'animate-shake' : ''} ${state.volcanoEventActive ? 'animate-shake-hard' : ''} ${state.gasEventActive ? 'animate-sway' : ''} ${state.monsterEventActive ? 'animate-shake' : ''}`}>
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

      {/* ADMIN PANEL */}
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

      {/* VICTORY MODAL */}
      {isWinner && (
         <div className="absolute inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center animate-fade-in">
             <div className="text-center">
                 <Trophy size={96} className="text-yellow-500 mx-auto mb-6 animate-bounce drop-shadow-[0_0_50px_rgba(234,179,8,0.8)]" />
                 <h1 className="text-6xl font-black text-white tracking-tighter uppercase mb-2">VICTORY</h1>
                 <p className="text-xl text-yellow-500 font-mono tracking-widest mb-8">SURVIVOR: {me?.name}</p>
                 
                 <div className="bg-gray-900 border border-gray-700 p-8 rounded-xl max-w-md mx-auto shadow-2xl relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500 animate-[loading_45s_linear]"></div>
                     
                     <p className="text-gray-400 font-mono text-sm mb-6">
                        Protocol complete. You have successfully eliminated all threats.
                        <br/><br/>
                        <span className="text-red-500">Auto-Termination in {cleanupTimer}s</span>
                     </p>
                     
                     <button 
                        onClick={handleClaim}
                        className="w-full py-4 bg-yellow-600 hover:bg-yellow-700 text-black font-bold font-mono tracking-[0.2em] rounded shadow-lg shadow-yellow-900/50 uppercase transition-all hover:scale-105"
                     >
                        CLAIM REWARD & EXIT
                     </button>
                 </div>
             </div>
         </div>
      )}

      {/* SURRENDER MODAL */}
      {showSurrenderModal && !isWinner && (
         <div className="absolute inset-0 z-[180] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-fade-in">
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
      {showDeathModal && !isLeaving && !showSurrenderModal && !isWinner && (
        <div className="absolute inset-0 z-[160] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-fade-in">
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
         <div className="absolute inset-0 z-[220] bg-black flex flex-col items-center justify-center">
            <Loader className="text-white animate-spin mb-4" size={32} />
            <p className="text-gray-400 font-mono tracking-widest animate-pulse">TERMINATING SESSION...</p>
         </div>
      )}
      
      {/* =========================================
          GLOBAL EVENT OVERLAYS (HIGHEST Z-INDEX)
          Must be last in markup to sit on top of everything
      ========================================= */}

      {/* 1. PERSISTENT ZONE CRACK OVERLAY */}
      {zoneLevel > 0 && (
         <div className="absolute inset-0 z-[100] pointer-events-none overflow-hidden">
             {/* Vignette Intensity scales with level, CAPPED at level 2 intensity to avoid Phase 3 darkening */}
             <div 
               className="absolute inset-0 transition-all duration-1000"
               style={{ 
                   boxShadow: `inset 0 0 ${Math.min(zoneLevel, 2) * 100}px ${Math.min(zoneLevel, 2) * 50}px rgba(0,0,0,${0.5 + Math.min(zoneLevel, 2) * 0.15})` 
               }}
             ></div>
             
             {/* Simple corner cracks simulated with borders/gradients */}
             <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-gray-800/50 opacity-50"></div>
             <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-gray-800/50 opacity-50"></div>
             {zoneLevel >= 2 && <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-black/80 to-transparent"></div>}
             {zoneLevel >= 3 && <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-black/80 to-transparent"></div>}
             
             {/* Phase 3 Cracked Screen Effect */}
             {showCracks && <CrackedScreenOverlay />}
         </div>
      )}

      {/* 2. WARNING OVERLAY (1 Day Before) */}
      {state.activeWarning && (
         <EventTitleOverlay 
            title={state.activeWarning.title} 
            subtitle={state.activeWarning.subtitle} 
            theme={state.activeWarning.theme} 
         />
      )}

      {/* 3. ZONE SHRINK ANIMATION OVERLAY (8s) */}
      {state.zoneShrinkActive && (
         <>
            {/* ATMOSPHERE */}
            <div className="absolute inset-0 z-[9998] pointer-events-none flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 animate-vignette-squeeze bg-transparent"></div>
                <div className="absolute inset-0 bg-transparent animate-crack-grow border-4 border-black/80 mix-blend-multiply"></div>
            </div>
            {/* TITLE */}
            <EventTitleOverlay title="ZONE COLLAPSE" subtitle="PERIMETER BREACHED" theme="ZONE" />
         </>
      )}

      {/* 4. VOLCANO OVERLAY (10s) */}
      {state.volcanoEventActive && (
         <>
            {/* ATMOSPHERE */}
            <div className="absolute inset-0 z-[9998] pointer-events-none overflow-hidden bg-red-900/30 mix-blend-multiply">
                <div className="absolute inset-0 backdrop-blur-[4px] animate-pulse"></div>
                <div className="absolute inset-0 w-full h-full animate-ash bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-repeat opacity-80"></div>
                <div className="absolute inset-0 bg-red-600/20 animate-volcano-flash mix-blend-color-dodge"></div>
            </div>
            {/* TITLE */}
            <EventTitleOverlay title="ERUPTION" subtitle="CATASTROPHIC FAILURE" theme="VOLCANO" />
         </>
      )}

      {/* 5. MONSTER HUNT OVERLAY */}
      {state.monsterEventActive && (
         <>
            {/* ATMOSPHERE */}
            <div className="absolute inset-0 z-[9998] pointer-events-none overflow-hidden bg-black/85 mix-blend-multiply">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_transparent_10%,_black_100%)]"></div>
            </div>
            {/* TITLE */}
            <EventTitleOverlay title="MONSTER HUNT" subtitle="SURVIVE THE NIGHT" theme="MONSTER" />
         </>
      )}

      {/* 6. GAS OVERLAY */}
      {state.gasEventActive && (
         <>
            {/* ATMOSPHERE */}
            <div className="absolute inset-0 z-[9998] pointer-events-none overflow-hidden">
                <div className="absolute inset-0 animate-gas-drift mix-blend-overlay opacity-90"></div>
                <div className="absolute inset-0 animate-toxic bg-green-900/20"></div>
                <div className="bg-noise opacity-30"></div>
            </div>
            {/* TITLE */}
            <EventTitleOverlay title="ACID STORM" subtitle="TOXICITY CRITICAL" theme="ACID" />
         </>
      )}

      {/* =========================================
          LEFT COLUMN (GAMEPLAY) - 75%
      ========================================= */}
      <div className="flex-[3] flex flex-col border-r border-gray-800 h-full relative">
         
         {/* NIGHT OVERLAY (Standard - Low Z) */}
         {!isDay && !state.volcanoEventActive && !state.gasEventActive && !state.monsterEventActive && !state.zoneShrinkActive && (
            <div className={`absolute inset-0 pointer-events-none z-0 mix-blend-overlay ${isVolcanoDay ? 'bg-red-900/40' : isGasDay ? 'bg-green-900/40' : 'bg-blue-900/10'}`}></div>
         )}
         
         {/* PRE-EVENT ATMOSPHERE (Standard - Low Z) */}
         {isVolcanoDay && !state.volcanoEventActive && (
             <div className="absolute inset-0 pointer-events-none z-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] animate-pulse"></div>
         )}
         {isGasDay && !state.gasEventActive && (
             <div className="absolute inset-0 pointer-events-none z-0 bg-green-500/5 backdrop-blur-[1px] animate-pulse"></div>
         )}
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
                <span>{isDay ? `00:${state.timeLeft.toString().padStart(2, '0')}` : (state.volcanoEventActive || state.gasEventActive || state.monsterEventActive || state.zoneShrinkActive) ? 'CRITICAL' : 'RESOLVING'}</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
               {/* SETTINGS BUTTON */}
               <button 
                  onClick={() => setShowSettings(true)}
                  className="p-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-400 hover:text-white rounded transition-colors"
               >
                  <Settings size={18} />
               </button>

               <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 uppercase tracking-widest">Alive</span>
                  <span className="text-3xl font-mono font-bold text-white">{aliveCount}<span className="text-gray-600 text-lg">/24</span></span>
               </div>
            </div>
         </header>

         {/* --- PLAYER GRID --- */}
         <div className="flex-1 p-6 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 to-black relative">
            {/* Lock Grid during event */}
            {(state.volcanoEventActive || state.gasEventActive || state.monsterEventActive || state.zoneShrinkActive) && <div className="absolute inset-0 z-40 bg-transparent cursor-not-allowed"></div>}
            
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
                  isVolcanoEvent={state.volcanoEventActive || state.gasEventActive || state.monsterEventActive || state.zoneShrinkActive}
                  isResolving={state.phase === Phase.NIGHT}
                />
              ))}
            </div>
         </div>

         {/* --- BOTTOM CONTROL PANEL --- */}
         <div className={`h-44 bg-black border-t border-gray-800 flex shrink-0 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] transition-opacity duration-500 ${(state.volcanoEventActive || state.gasEventActive || state.monsterEventActive || state.zoneShrinkActive) ? 'opacity-20 pointer-events-none grayscale' : 'opacity-100'}`}>
            
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
                 adminNoCost={state.adminNoCost}
               />
            </div>
         </div>
      </div>

      {/* =========================================
          RIGHT COLUMN (COMMS) - 25%
      ========================================= */}
      <div className={`flex-1 flex flex-col h-full bg-gray-950 min-w-[300px] max-w-[400px] transition-opacity duration-500 ${(state.volcanoEventActive || state.gasEventActive || state.monsterEventActive || state.zoneShrinkActive) ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
         
         {/* --- TOP-RIGHT EXIT HEADER --- */}
         <div className="h-16 bg-black border-b border-gray-800 flex items-center justify-end px-4 shrink-0 gap-3">
             {state.isPractice && (
                 <button 
                    onClick={() => setShowAdminPanel(true)}
                    className="flex items-center gap-2 bg-yellow-900/20 hover:bg-yellow-900/40 border border-yellow-700/50 text-yellow-500 px-3 py-1.5 rounded transition-all text-xs font-bold font-mono tracking-widest group"
                 >
                    <Settings size={14} className="group-hover:rotate-90 transition-transform" />
                    ADMIN
                 </button>
             )}
             
             {isDead ? (
                 <button 
                    onClick={handleLeave}
                    className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 px-3 py-1.5 rounded transition-all text-xs font-bold font-mono tracking-widest group"
                 >
                    <LogOut size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    EXIT MATCH
                 </button>
             ) : (
                 <button 
                    onClick={() => setShowSurrenderModal(true)}
                    disabled={isWinner}
                    className="flex items-center gap-2 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-500 px-3 py-1.5 rounded transition-all text-xs font-bold font-mono tracking-widest disabled:opacity-50 disabled:cursor-not-allowed group"
                 >
                    <AlertTriangle size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    SURRENDER
                 </button>
             )}
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

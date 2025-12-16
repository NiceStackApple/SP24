import React, { useEffect, useState } from 'react';
import { Player, PlayerStatus, BattleEvent, ActionType } from '../types';
import { Shield, ZapOff, Sword, Wind, Moon, Crosshair, Utensils, Zap, Skull, PlusCircle, Flame } from 'lucide-react';
import { GAME_CONFIG } from '../constants';

interface PlayerCardProps {
  player: Player;
  isMe: boolean;
  isSelected: boolean;
  activeEvent: BattleEvent | null;
  pendingActionType?: ActionType;
  isVolcanoEvent?: boolean;
  onSelect: (id: string) => void;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ 
  player, 
  isMe, 
  isSelected, 
  activeEvent, 
  pendingActionType,
  isVolcanoEvent,
  onSelect 
}) => {
  const isDead = player.status === PlayerStatus.DEAD;
  const isStunned = player.status === PlayerStatus.STUNNED;
  const hpPercent = (player.hp / GAME_CONFIG.START_HP) * 100;
  
  let hpColor = 'bg-green-500';
  if (hpPercent < 50) hpColor = 'bg-yellow-500';
  if (hpPercent < 20) hpColor = 'bg-red-500';

  // Animation Sequence States
  const [highlight, setHighlight] = useState<string | null>(null);
  const [dimmed, setDimmed] = useState(false);
  const [showActionIcon, setShowActionIcon] = useState<React.ReactNode | null>(null);
  const [showDamage, setShowDamage] = useState<{ text: string, color: string } | null>(null);
  const [swordSwing, setSwordSwing] = useState(false);
  const [slashEffect, setSlashEffect] = useState(false);
  
  // Physical Movement State
  const [transformStyle, setTransformStyle] = useState<React.CSSProperties>({});
  const [isTopLayer, setIsTopLayer] = useState(false);

  useEffect(() => {
    // RESET ALL STATES IF NO EVENT
    if (!activeEvent) {
       setHighlight(null);
       setDimmed(false);
       setShowActionIcon(null);
       setShowDamage(null);
       setSwordSwing(false);
       setSlashEffect(false);
       setTransformStyle({});
       setIsTopLayer(false);
       return;
    }

    // Mass Events Handling (Bypass sequence)
    if (isVolcanoEvent) return;

    const isSource = activeEvent.sourceId === player.id;
    const isTarget = activeEvent.targetId === player.id;
    const isAttack = activeEvent.type === ActionType.ATTACK;

    // --- ATTACKER LOGIC (Physical Move) ---
    if (isSource && isAttack) {
        setDimmed(false);
        setHighlight('YELLOW'); // Attacker is YELLOW
        setIsTopLayer(true); // Bring to front

        // Calculate Physical Move
        const targetEl = document.getElementById(`player-card-${activeEvent.targetId}`);
        const sourceEl = document.getElementById(`player-card-${player.id}`);
        
        if (targetEl && sourceEl) {
             const tRect = targetEl.getBoundingClientRect();
             const sRect = sourceEl.getBoundingClientRect();
             
             // Move to overlap target slightly (20% offset x, 10% offset y)
             const dx = tRect.left - sRect.left + (tRect.width * 0.2); 
             const dy = tRect.top - sRect.top + (tRect.height * 0.1);

             setTransformStyle({
                 transform: `translate(${dx}px, ${dy}px)`,
                 transition: 'transform 0.5s ease-in-out',
                 zIndex: 100
             });

             // Auto-scroll logic: Follow the attacker
             targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
             
             // Trigger Sword Swing at Impact (500ms)
             setTimeout(() => setSwordSwing(true), 500);
        }
    } 
    // --- GENERIC SOURCE LOGIC (Shoot/Eat/Rest etc) ---
    else if (isSource) {
       // Step 1: Auto Scroll (except for Shoot which stays in place but highlights)
       if (activeEvent.type !== ActionType.SHOOT) {
          const el = document.getElementById(`player-card-${player.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
       }
       
       setDimmed(false);
       
       // Highlights
       if (activeEvent.type === ActionType.SHOOT) {
          setHighlight('YELLOW'); // Shooter lights up YELLOW
       } else {
          setHighlight(activeEvent.type);
       }

       // STRICT ICON RULE: Flat, no animation, instant.
       if ([ActionType.REST, ActionType.EAT, ActionType.RUN, ActionType.HEAL].includes(activeEvent.type as ActionType)) {
            let icon = null;
            if (activeEvent.type === ActionType.REST) icon = <Moon size={28} className="text-purple-400 fill-purple-400/20" />;
            if (activeEvent.type === ActionType.EAT) icon = <Utensils size={28} className="text-orange-400 fill-orange-400/20" />;
            if (activeEvent.type === ActionType.RUN) icon = <Wind size={28} className="text-cyan-400 fill-cyan-400/20" />;
            if (activeEvent.type === ActionType.HEAL) icon = <PlusCircle size={28} className="text-green-400 fill-green-400/20" />;
            
            if (icon) setShowActionIcon(icon);

            // Show Float Text after brief delay
            setTimeout(() => {
                if (activeEvent.type === ActionType.RUN) {
                    if (!activeEvent.isMiss) setShowDamage({ text: "EXPLORED", color: "text-cyan-400" });
                } else if (activeEvent.type === ActionType.EAT) {
                    setShowDamage({ text: "+EAT", color: "text-orange-400" });
                } else if (activeEvent.type === ActionType.REST) {
                    setShowDamage({ text: "+REST", color: "text-purple-400" });
                }
            }, 200);
       }
    } 
    // --- TARGET LOGIC ---
    else if (isTarget) {
       // Step 1: Auto Scroll
       if (!isAttack) { // For Attack, source scrolls to target already
           const el = document.getElementById(`player-card-${player.id}`);
           if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
       }
       
       setDimmed(false);
       setHighlight('RED'); // Target is RED

       // Impact Phase
       const actionTimer = setTimeout(() => {
            if (activeEvent.type === ActionType.ATTACK) {
                // Triggered at 500ms (Collision)
                if (activeEvent.isMiss) {
                    setShowDamage({ text: "MISS", color: "text-blue-400 font-bold" });
                } else if (activeEvent.isBlocked) {
                    setShowDamage({ text: `BLOCKED`, color: "text-blue-300" });
                } else {
                    setSlashEffect(true);
                    // Damage number appears exactly with slash
                    setShowDamage({ text: `-${activeEvent.value}`, color: "text-red-500 font-bold text-2xl" });
                }
            } else if (activeEvent.type === ActionType.SHOOT) {
                // Reuse slash/impact effect for pistol but make damage bigger
                setSlashEffect(true); 
                setShowDamage({ text: `-${activeEvent.value}`, color: "text-red-500 font-bold text-4xl" });
            } else if (activeEvent.type === ActionType.HEAL) {
                setShowDamage({ text: `+${activeEvent.value}`, color: "text-green-400 font-bold" });
            }
       }, 400); // 400ms for Shoot (matches engine) / 500ms for Attack roughly works here

       return () => clearTimeout(actionTimer);
    } else {
       // Neither source nor target
       setDimmed(true);
       setHighlight(null);
    }
  }, [activeEvent, player.id, isVolcanoEvent]);

  // Mass Event Animations
  let animClass = '';
  if (isVolcanoEvent && !isDead) {
      if (player.lastAction === ActionType.RUN) {
          animClass = 'border-cyan-500 ring-4 ring-cyan-500/50 shadow-[0_0_30px_#06b6d4] scale-105 transition-all duration-300 animate-pulse';
      } else {
          animClass = 'border-red-600 ring-4 ring-orange-600/50 shadow-[0_0_50px_#f00] animate-shake-hard bg-red-900/30';
      }
  }

  // Active Highlight Logic
  if (highlight) {
      if (highlight === 'RED') {
          // TARGET
          animClass = 'border-red-600 shadow-[0_0_25px_rgba(220,38,38,0.8)] scale-105 z-20';
          // Shake effect if damaged
          if (slashEffect) animClass += ' animate-shake-hard';
      } else if (highlight === 'YELLOW') {
          // ATTACKER (SWORD + PISTOL)
          animClass = 'border-yellow-500 shadow-[0_0_25px_rgba(234,179,8,0.8)] scale-110 z-50';
      } else {
          // OTHER ACTIONS
          switch (highlight) {
              case ActionType.EAT:
                  animClass = 'border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.6)] scale-105 z-20';
                  break;
              case ActionType.REST:
                  animClass = 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.6)] scale-105 z-20';
                  break;
              case ActionType.HEAL:
                  animClass = 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.6)] scale-105 z-20';
                  break;
              case ActionType.RUN:
                  animClass = 'border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.6)] scale-105 z-20';
                  break;
              case ActionType.DEFEND:
                  animClass = 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.6)] scale-105 z-20';
                  break;
              default:
                  animClass = 'border-white shadow-[0_0_15px_rgba(255,255,255,0.4)] scale-105 z-20';
          }
      }
  }

  const getActionIcon = (type: ActionType) => {
    switch(type) {
      case ActionType.ATTACK: return <Sword size={16} className="text-red-400" />;
      case ActionType.SHOOT: return <Crosshair size={16} className="text-yellow-400" />;
      case ActionType.DEFEND: return <Shield size={16} className="text-blue-400" />;
      case ActionType.RUN: return <Wind size={16} className="text-cyan-400" />;
      case ActionType.EAT: return <Utensils size={16} className="text-orange-400" />;
      case ActionType.REST: return <Moon size={16} className="text-purple-400" />;
      case ActionType.HEAL: return <PlusCircle size={16} className="text-green-400" />;
      default: return null;
    }
  };

  return (
    <div 
      id={`player-card-${player.id}`}
      onClick={() => !isDead && !isMe && onSelect(player.id)}
      style={transformStyle}
      className={`
        relative flex flex-col p-2 rounded border-2 transition-all duration-200 cursor-pointer overflow-hidden
        h-[130px] w-full
        ${isMe ? 'border-yellow-500/70 bg-yellow-900/10' : ''}
        ${isSelected ? 'border-red-500 ring-2 ring-red-500 scale-[1.02] z-20 bg-red-900/20' : 'border-gray-800 bg-gray-900/60 hover:bg-gray-800'}
        ${isDead ? 'opacity-40 grayscale border-gray-900' : ''}
        ${dimmed && !isVolcanoEvent ? 'opacity-30 blur-[1px]' : 'opacity-100'}
        ${isTopLayer ? 'z-[100]' : ''}
        ${animClass}
      `}
    >
      {/* Pending Action Icon (Daytime) */}
      {isMe && pendingActionType && pendingActionType !== ActionType.NONE && !isDead && !isVolcanoEvent && (
        <div className="absolute top-1 right-1 bg-gray-900 border border-gray-600 rounded-full p-1.5 z-20 shadow-lg">
          {getActionIcon(pendingActionType)}
        </div>
      )}

      {/* VFX Layers */}
      
      {/* Step 3: Action Icon (Source) - STRICT: NO ANIMATION, NO BACKGROUND, INSTANT */}
      {showActionIcon && (
         <div className="absolute top-1 right-1 z-40 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {showActionIcon}
         </div>
      )}

      {/* Damage/Heal Text */}
      {showDamage && (
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none whitespace-nowrap animate-damage-pop ${showDamage.color} font-mono font-bold text-2xl text-shadow-md`}>
          {showDamage.text}
        </div>
      )}
      
      {/* SWORD SWING ANIMATION - Triggers after collision */}
      {swordSwing && (
        <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
            <Sword 
               size={96} 
               className="text-gray-100 animate-sword-slash drop-shadow-[0_0_15px_black]" 
               fill="white"
            />
        </div>
      )}

      {/* SLASH EFFECT / IMPACT */}
      {slashEffect && (
        <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
           {/* White Slash Line */}
           <div className="absolute top-1/2 left-1/2 w-[150%] h-2 bg-white -translate-x-1/2 -translate-y-1/2 rotate-45 shadow-[0_0_20px_red]"></div>
           {/* Red Flash */}
           <div className="absolute inset-0 bg-red-600/60 mix-blend-overlay"></div>
        </div>
      )}

      {/* Volcano/Gas Overlay on Card */}
      {isVolcanoEvent && player.lastAction !== ActionType.RUN && !isDead && (
         <div className="absolute inset-0 pointer-events-none z-0">
             <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-red-600/50 to-transparent animate-pulse"></div>
         </div>
      )}

      {/* Card Header: Avatar + Name */}
      <div className="flex items-start space-x-2 mb-2 z-10 relative">
        <div className="w-10 h-10 rounded bg-gray-800 overflow-hidden flex-shrink-0 border border-gray-700">
          <img 
            src={`https://picsum.photos/seed/${player.avatarId}/200`} 
            alt="avatar" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center justify-between">
            <p className={`text-sm font-bold truncate ${isMe ? 'text-yellow-400' : 'text-gray-200'}`}>
              {player.name}
            </p>
          </div>
          <div className="flex items-center gap-1">
             {isDead ? (
                <span className="text-[10px] uppercase font-bold text-red-600 flex items-center gap-1">
                   <Skull size={10} /> DEAD
                </span>
             ) : (
                <span className="text-[10px] uppercase font-bold text-green-500">ALIVE</span>
             )}
             {isStunned && <span className="text-[10px] text-purple-400 font-bold ml-1 animate-pulse flex items-center gap-1"><ZapOff size={8} /> STUN</span>}
          </div>
        </div>
      </div>

      {!isDead ? (
        <div className="flex-1 flex flex-col justify-end space-y-1.5 z-10 relative">
          {/* Main HP Bar */}
          <div className="w-full bg-gray-950 rounded border border-gray-700 h-4 relative overflow-hidden">
             <div className={`h-full ${hpColor} transition-all duration-300`} style={{ width: `${Math.max(0, hpPercent)}%` }} />
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 gap-2">
             <div className="flex flex-col">
               <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500" style={{ width: `${player.hunger}%`}}></div>
               </div>
             </div>
             <div className="flex flex-col">
               <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${player.fatigue}%`}}></div>
               </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center">
           <span className="text-red-700 font-bold border-2 border-red-800 px-3 py-1 rounded -rotate-12 opacity-80 uppercase tracking-widest text-lg">
             ELIMINATED
           </span>
        </div>
      )}
    </div>
  );
};
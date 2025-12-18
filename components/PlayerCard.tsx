
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
  isResolving: boolean;
  onSelect: (id: string) => void;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ 
  player, 
  isMe, 
  isSelected, 
  activeEvent, 
  pendingActionType, 
  isVolcanoEvent,
  isResolving,
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
  const [showBlockShield, setShowBlockShield] = useState(false); 
  const [showDamage, setShowDamage] = useState<{ text: string, color: string } | null>(null);
  const [swordSwing, setSwordSwing] = useState(false);
  const [slashEffect, setSlashEffect] = useState(false);
  const [muzzleFlash, setMuzzleFlash] = useState(false); // PISTOL
  const [bulletImpact, setBulletImpact] = useState(false); // PISTOL
  const [healEffect, setHealEffect] = useState(false); // HEAL
  
  // Physical Movement State
  const [transformStyle, setTransformStyle] = useState<React.CSSProperties>({});
  const [isTopLayer, setIsTopLayer] = useState(false);

  useEffect(() => {
    if (!activeEvent) {
       setHighlight(null);
       setDimmed(isResolving);
       setShowActionIcon(null);
       setShowBlockShield(false);
       setShowDamage(null);
       setSwordSwing(false);
       setSlashEffect(false);
       setMuzzleFlash(false);
       setBulletImpact(false);
       setHealEffect(false);
       setTransformStyle({ transform: 'translate(0,0)', transition: 'none' });
       setIsTopLayer(false);
       return;
    }

    if (isVolcanoEvent) return;

    const isSource = activeEvent.sourceId === player.id;
    const isTarget = activeEvent.targetId === player.id;
    const isAttack = activeEvent.type === ActionType.ATTACK;
    const isShoot = activeEvent.type === ActionType.SHOOT;
    const isHeal = activeEvent.type === ActionType.HEAL;

    if (isSource && isAttack) {
        setDimmed(false);
        setHighlight('YELLOW'); 
        setIsTopLayer(true); 

        const targetEl = document.getElementById(`player-card-${activeEvent.targetId}`);
        const sourceEl = document.getElementById(`player-card-${player.id}`);
        
        if (targetEl && sourceEl) {
             const xDiff = targetEl.offsetLeft - sourceEl.offsetLeft;
             const yDiff = targetEl.offsetTop - sourceEl.offsetTop;
             // Reduced offsets for tighter grid
             const dx = xDiff * 0.8; 
             const dy = yDiff * 0.8;

             setTransformStyle({
                 transform: `translate(${dx}px, ${dy}px)`,
                 transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
                 zIndex: 100
             });
             setTimeout(() => setSwordSwing(true), 500);
        }
    } 
    else if (isSource && isShoot) {
        setDimmed(false);
        setHighlight('YELLOW');
        setMuzzleFlash(true);
        setTimeout(() => setMuzzleFlash(false), 100);
    }
    else if (isSource && isHeal) {
        setDimmed(false);
        setHighlight('HEAL');
        setShowActionIcon(<PlusCircle size={28} className="text-green-400 fill-green-400/20" />);
    }
    else if (isSource) {
       setDimmed(false);
       setHighlight(activeEvent.type);

       if ([ActionType.REST, ActionType.EAT, ActionType.RUN].includes(activeEvent.type as ActionType)) {
            let icon = null;
            if (activeEvent.type === ActionType.REST) icon = <Moon size={28} className="text-purple-400 fill-purple-400/20" />;
            if (activeEvent.type === ActionType.EAT) icon = <Utensils size={28} className="text-orange-400 fill-orange-400/20" />;
            if (activeEvent.type === ActionType.RUN) icon = <Wind size={28} className="text-cyan-400 fill-cyan-400/20" />;
            
            if (icon) setShowActionIcon(icon);

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
    else if (isTarget) {
       setDimmed(false);
       setHighlight(isHeal ? 'HEAL' : 'RED');

       if (activeEvent.isBlocked) setShowBlockShield(true);

       if (activeEvent.isMiss && !isDead && player.lastAction === ActionType.RUN) {
          const dir = Math.random() > 0.5 ? 1 : -1;
          setTransformStyle({
              transform: `translateX(${dir * 20}px) rotate(${dir * 5}deg)`,
              transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          });
          setTimeout(() => {
              setTransformStyle({
                  transform: 'translateX(0) rotate(0)',
                  transition: 'transform 0.2s ease-in'
              });
          }, 300);
       }

       const actionTimer = setTimeout(() => {
            if (isAttack) {
                if (activeEvent.isMiss) {
                    const isDodge = !isDead && player.lastAction === ActionType.RUN;
                    setShowDamage({ text: isDodge ? "DODGE" : "MISS", color: "text-blue-400 font-bold" });
                } else if (activeEvent.isBlocked) {
                    setShowDamage({ text: `BLOCKED`, color: "text-blue-300 font-bold" });
                } else {
                    setSlashEffect(true);
                    setShowDamage({ text: `-${activeEvent.value}`, color: "text-red-500 font-bold text-xl lg:text-2xl" });
                }
            } else if (isShoot) {
                setBulletImpact(true);
                setShowDamage({ text: `-${activeEvent.value}`, color: "text-red-500 font-bold text-2xl lg:text-4xl" });
            } else if (isHeal) {
                setHealEffect(true);
                setShowDamage({ text: `+${activeEvent.value}`, color: "text-green-400 font-bold text-xl lg:text-2xl" });
            } else if (activeEvent.type === 'VOLCANO' || activeEvent.type === 'POISON' || activeEvent.type === 'MONSTER') {
                setSlashEffect(true); 
                setShowDamage({ text: `-${activeEvent.value}`, color: "text-red-500 font-bold text-xl lg:text-2xl" });
            }
       }, isShoot ? 200 : (isHeal ? 800 : 400)); 

       return () => clearTimeout(actionTimer);
    } else {
       setDimmed(true);
       setHighlight(null);
    }
  }, [activeEvent, player.id, isVolcanoEvent, isResolving]);

  let animClass = '';
  if (isVolcanoEvent && !isDead) {
      if (player.lastAction === ActionType.RUN) {
          animClass = 'border-cyan-500 ring-2 ring-cyan-500/50 shadow-[0_0_15px_#06b6d4] scale-105 transition-all duration-300 animate-pulse';
      } else {
          animClass = 'border-red-600 ring-2 ring-orange-600/50 shadow-[0_0_20px_#f00] animate-shake-hard bg-red-900/30';
      }
  }

  if (highlight) {
      if (highlight === 'RED') {
          animClass = 'border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.8)] scale-105 z-20';
          if (slashEffect || bulletImpact) animClass += ' animate-shake-hard';
      } else if (highlight === 'YELLOW') {
          animClass = 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.8)] scale-110 z-50';
      } else if (highlight === 'HEAL') {
          animClass = 'border-green-500 shadow-[0_0_15px_rgba(74,222,128,0.8)] scale-105 z-20 bg-green-900/20';
      } else {
          animClass = 'border-white shadow-[0_0_10px_rgba(255,255,255,0.4)] scale-105 z-20';
      }
  }

  const getActionIcon = (type: ActionType) => {
    switch(type) {
      case ActionType.ATTACK: return <Sword size={12} className="text-red-400" />;
      case ActionType.SHOOT: return <Crosshair size={12} className="text-yellow-400" />;
      case ActionType.DEFEND: return <Shield size={12} className="text-blue-400" />;
      case ActionType.RUN: return <Wind size={12} className="text-cyan-400" />;
      case ActionType.EAT: return <Utensils size={12} className="text-orange-400" />;
      case ActionType.REST: return <Moon size={12} className="text-purple-400" />;
      case ActionType.HEAL: return <PlusCircle size={12} className="text-green-400" />;
      default: return null;
    }
  };

  return (
    <div 
      id={`player-card-${player.id}`}
      onClick={() => !isDead && !isMe && onSelect(player.id)}
      style={transformStyle}
      className={`
        relative flex flex-col p-1 lg:p-2 rounded border-2 transition-all duration-200 cursor-pointer overflow-hidden
        h-24 lg:h-[130px] w-full
        ${isMe ? 'border-yellow-500/70 bg-yellow-900/10' : ''}
        ${isSelected ? 'border-red-500 ring-2 ring-red-500 scale-[1.02] z-20 bg-red-900/20' : 'border-gray-800 bg-gray-900/60 hover:bg-gray-800'}
        ${isDead ? 'opacity-40 grayscale border-gray-900' : ''}
        ${dimmed && !isVolcanoEvent ? 'opacity-30 blur-[1px]' : 'opacity-100'}
        ${isTopLayer ? 'z-[100]' : ''}
        ${animClass}
      `}
    >
      {/* PENDING ACTION ICON (TOP RIGHT) */}
      {isMe && pendingActionType && pendingActionType !== ActionType.NONE && !isDead && !isVolcanoEvent && (
        <div className="absolute top-0.5 right-0.5 bg-gray-900 border border-gray-600 rounded-full p-0.5 z-20 shadow-lg">
          {getActionIcon(pendingActionType)}
        </div>
      )}

      {/* EVENT OVERLAY ICONS */}
      {showActionIcon && (
         <div className="absolute top-1 right-1 z-40 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {showActionIcon}
         </div>
      )}

      {showBlockShield && (
          <div className="absolute top-1 right-1 z-40 animate-shield-flash">
               <Shield size={20} className="text-blue-400 fill-blue-900/50" />
          </div>
      )}

      {showDamage && (
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none whitespace-nowrap animate-damage-pop ${showDamage.color} font-mono font-bold text-sm lg:text-2xl text-shadow-md`}>
          {showDamage.text}
        </div>
      )}
      
      {/* ANIMATIONS */}
      {swordSwing && (
        <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
            <Sword size={48} className="text-gray-100 animate-sword-slash drop-shadow-[0_0_15px_black]" fill="white" />
        </div>
      )}

      {slashEffect && (
        <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
           <div className="absolute top-1/2 left-1/2 w-[150%] h-2 bg-white -translate-x-1/2 -translate-y-1/2 rotate-45 shadow-[0_0_20px_red]"></div>
           <div className="absolute inset-0 bg-red-600/60 mix-blend-overlay"></div>
        </div>
      )}

      {muzzleFlash && (
          <div className="absolute inset-0 z-50 bg-white mix-blend-screen animate-pulse pointer-events-none"></div>
      )}
      {bulletImpact && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 bg-white rounded-full blur-md animate-ping opacity-80"></div>
              <div className="absolute inset-0 bg-white/30 mix-blend-overlay"></div>
          </div>
      )}

      {healEffect && (
          <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
              <div className="absolute bottom-0 left-1/4 w-1 h-1 bg-green-400 animate-[ash-fall_1s_reverse_infinite] rounded-full"></div>
              <div className="absolute bottom-0 right-1/4 w-1 h-1 bg-green-400 animate-[ash-fall_1.5s_reverse_infinite] rounded-full delay-100"></div>
              <div className="absolute inset-0 bg-green-500/20 mix-blend-screen"></div>
          </div>
      )}

      {isVolcanoEvent && player.lastAction !== ActionType.RUN && !isDead && (
         <div className="absolute inset-0 pointer-events-none z-0">
             <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-red-600/50 to-transparent animate-pulse"></div>
         </div>
      )}

      {/* CONTENT: Compact 4-col Layout */}
      <div className="flex flex-col h-full z-10 relative">
        <div className="flex items-center space-x-1 mb-1">
            {/* Tiny Avatar */}
            <div className="w-6 h-6 lg:w-10 lg:h-10 rounded bg-gray-800 overflow-hidden flex-shrink-0 border border-gray-700">
              <img src={`https://picsum.photos/seed/${player.avatarId}/200`} alt="avatar" className="w-full h-full object-cover" />
            </div>
            {/* Name & Status */}
            <div className="min-w-0 flex-1 overflow-hidden">
                <div className={`text-[10px] lg:text-sm font-bold truncate leading-none ${isMe ? 'text-yellow-400' : 'text-gray-200'}`}>
                    {player.name}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                    {isDead ? (
                        <span className="text-[8px] lg:text-[10px] uppercase font-bold text-red-600 flex items-center gap-0.5"><Skull size={8} /> DEAD</span>
                    ) : (
                        <span className="text-[8px] lg:text-[10px] uppercase font-bold text-green-500 leading-none">ALIVE</span>
                    )}
                    {isStunned && <ZapOff size={8} className="text-purple-400 animate-pulse" />}
                </div>
            </div>
        </div>

        {!isDead ? (
            <div className="flex-1 flex flex-col justify-end space-y-1">
                {/* HP Bar */}
                <div className="w-full bg-gray-950 rounded border border-gray-700 h-2 lg:h-4 relative overflow-hidden">
                    <div className={`h-full ${hpColor} transition-all duration-300`} style={{ width: `${Math.max(0, hpPercent)}%` }} />
                </div>
                {/* Secondary Stats: Hidden on Mobile 4-col to save space/clutter, visible on Desktop */}
                <div className="hidden lg:grid grid-cols-2 gap-2">
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500" style={{ width: `${player.hunger}%`}}></div>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${player.fatigue}%`}}></div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center pointer-events-none">
                <span className="text-red-700 font-bold border-2 border-red-800 px-1 py-0.5 lg:px-3 lg:py-1 rounded -rotate-12 opacity-80 uppercase tracking-widest text-[10px] lg:text-lg">KILLED</span>
            </div>
        )}
      </div>
    </div>
  );
};

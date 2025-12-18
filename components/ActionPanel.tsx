
import React, { useState, useEffect, useRef } from 'react';
import { ActionType, Player, PlayerStatus, Phase } from '../types';
import { Sword, Shield, Wind, Utensils, Moon, Crosshair, PlusCircle, Backpack } from 'lucide-react';
import { GAME_CONFIG } from '../constants';
import { BagModal } from './BagModal';

interface ActionPanelProps {
  player: Player | undefined;
  phase: Phase;
  day: number;
  pendingAction: { type: ActionType, targetId?: string | null };
  onActionSelect: (type: ActionType) => void;
  onUseItem: (item: string) => void;
  adminNoCost?: boolean;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({ 
  player, 
  phase, 
  day,
  pendingAction,
  onActionSelect,
  onUseItem,
  adminNoCost
}) => {
  const [showBag, setShowBag] = useState(false);
  const [hasNewItems, setHasNewItems] = useState(false);
  // Track inventory size to detect new items
  const prevInventoryLenRef = useRef(player?.inventory.length || 0);

  useEffect(() => {
    if (!player) return;
    const currentLen = player.inventory.length;
    
    // If inventory grew AND bag isn't currently open, show dot
    if (currentLen > prevInventoryLenRef.current) {
        if (!showBag) {
            setHasNewItems(true);
        }
    }
    
    prevInventoryLenRef.current = currentLen;
  }, [player?.inventory.length, showBag, player]);

  const handleOpenBag = () => {
      setShowBag(true);
      setHasNewItems(false); // Clear notification on open
  };

  if (!player || player.status === PlayerStatus.DEAD) {
      return (
          <div className="h-full flex items-center justify-center">
              <span className="text-gray-600 font-mono text-sm uppercase">Connection Lost (Deceased)</span>
          </div>
      )
  }

  const isStunned = player.status === PlayerStatus.STUNNED;
  const isNight = phase === Phase.NIGHT || phase === Phase.GAME_OVER;
  const isLockdown = day >= GAME_CONFIG.LOCKDOWN_DAY;

  if (isNight) return (
      <div className="h-full flex items-center justify-center">
          <span className="text-blue-500/50 font-mono text-sm animate-pulse tracking-widest uppercase">
            Resolving Night Phase...
          </span>
      </div>
  );

  const attackAction = player.hasPistol 
    ? { 
        type: ActionType.SHOOT, 
        icon: (s: number) => <Crosshair size={s} />, 
        label: 'SHOOT', 
        desc: `${GAME_CONFIG.PISTOL_DAMAGE_MIN}-${GAME_CONFIG.PISTOL_DAMAGE_MAX} DMG`,
        hunger: GAME_CONFIG.PISTOL_COST_HUNGER,
        fatigue: GAME_CONFIG.PISTOL_COST_FATIGUE,
        color: 'text-yellow-400', 
        border: 'border-yellow-600', 
        bg: 'bg-yellow-900/20',
        cooldown: 0,
        isGain: false
      }
    : { 
        type: ActionType.ATTACK, 
        icon: (s: number) => <Sword size={s} />, 
        label: 'ATTACK', 
        desc: '30-40 DMG',
        hunger: GAME_CONFIG.COST_ATTACK_HUNGER,
        fatigue: GAME_CONFIG.COST_ATTACK_FATIGUE,
        color: 'text-red-400', 
        border: 'border-red-600', 
        bg: 'bg-red-900/20',
        isGain: false
      };

  const actions = [
    attackAction,
    { 
        type: ActionType.DEFEND, 
        icon: (s: number) => <Shield size={s} />, 
        label: 'DEFEND', 
        desc: 'Block Dmg',
        hunger: GAME_CONFIG.COST_DEFEND_HUNGER,
        fatigue: GAME_CONFIG.COST_DEFEND_FATIGUE,
        color: 'text-blue-400', 
        border: 'border-blue-600', 
        bg: 'bg-blue-900/20',
        isGain: false
    },
    { 
        type: ActionType.RUN, 
        icon: (s: number) => <Wind size={s} />, 
        label: 'EXPLORE', 
        desc: 'Dodge + Loot',
        hunger: GAME_CONFIG.COST_RUN_HUNGER,
        fatigue: GAME_CONFIG.COST_RUN_FATIGUE,
        color: 'text-cyan-400', 
        border: 'border-cyan-600', 
        bg: 'bg-cyan-900/20',
        cooldown: player.cooldowns.run,
        isGain: false 
    },
    { 
        type: ActionType.HEAL, 
        icon: (s: number) => <PlusCircle size={s} />, 
        label: 'HEAL', 
        desc: `+${GAME_CONFIG.HEAL_AMOUNT} HP`,
        hunger: 0,
        fatigue: GAME_CONFIG.COST_HEAL_FATIGUE,
        color: 'text-emerald-400', 
        border: 'border-emerald-600', 
        bg: 'bg-emerald-900/20',
        cooldown: 0,
        isGain: false,
        disabledCondition: player.fatigue < GAME_CONFIG.COST_HEAL_FATIGUE
    },
    { 
        type: ActionType.EAT, 
        icon: (s: number) => <Utensils size={s} />, 
        label: 'EAT', 
        desc: `+${GAME_CONFIG.EAT_REGEN} Hunger`,
        hunger: -GAME_CONFIG.EAT_REGEN, 
        fatigue: 0,
        color: 'text-orange-400', 
        border: 'border-orange-600', 
        bg: 'bg-orange-900/20',
        cooldown: player.cooldowns.eat,
        isGain: true,
        disabledCondition: isLockdown
    },
    { 
        type: ActionType.REST, 
        icon: (s: number) => <Moon size={s} />, 
        label: 'REST', 
        desc: `+${GAME_CONFIG.REST_REGEN} Fatigue`,
        hunger: 0,
        fatigue: -GAME_CONFIG.REST_REGEN, 
        color: 'text-purple-400', 
        border: 'border-purple-600', 
        bg: 'bg-purple-900/20',
        cooldown: player.cooldowns.rest,
        isGain: true,
        disabledCondition: isLockdown
    },
  ];

  return (
    <div className="h-full flex items-center gap-2 md:gap-3 relative">
      <BagModal 
         isOpen={showBag} 
         inventory={player.inventory} 
         equippedItem={null}
         onEquip={onUseItem}
         onClose={() => setShowBag(false)}
      />

      {actions.map((act) => {
        const isActive = pendingAction.type === act.type;
        
        // Strict Cost Logic
        let costH = act.isGain ? 0 : act.hunger;
        let costF = act.isGain ? 0 : act.fatigue;
        
        if (adminNoCost) {
            costH = 0;
            costF = 0;
        }

        const hasStats = player.hunger >= costH && player.fatigue >= costF;

        // Stun Logic: If stunned, only Eat/Rest allowed
        const isAllowedWhileStunned = act.type === ActionType.EAT || act.type === ActionType.REST;
        const isBlockedByStun = isStunned && !isAllowedWhileStunned;

        // @ts-ignore
        const isDisabled = !adminNoCost && (isBlockedByStun || !hasStats || (act.cooldown && act.cooldown > 0) || (act.disabledCondition));
        
        return (
          <button
            key={act.type}
            onClick={() => !isDisabled && onActionSelect(act.type)}
            disabled={isDisabled as boolean}
            className={`
              relative flex flex-col items-center justify-between p-1.5 md:p-2 rounded-lg border-2 transition-all duration-200 
              h-24 w-24 md:h-28 md:w-28 text-center shrink-0
              ${isActive ? `${act.border} ${act.bg} shadow-[0_0_15px_rgba(0,0,0,0.5)] scale-105 z-10` : 'border-gray-800 bg-gray-900 hover:bg-gray-800 hover:border-gray-600'}
              ${isDisabled ? 'opacity-40 grayscale cursor-not-allowed' : 'hover:-translate-y-1'}
            `}
          >
            <div className={`text-[10px] md:text-xs font-bold font-mono tracking-widest ${isActive ? 'text-white' : 'text-gray-400'}`}>
              {act.label}
            </div>
            <div className={`${isActive ? act.color : 'text-gray-500'} mb-0.5 md:mb-1 hidden md:block`}>
              {act.icon(28)}
            </div>
            <div className={`${isActive ? act.color : 'text-gray-500'} mb-0.5 md:mb-1 block md:hidden`}>
              {act.icon(20)}
            </div>
            <div className="w-full space-y-0.5 md:space-y-1">
               <div className="text-[9px] md:text-[10px] font-mono text-gray-300 truncate leading-none">{act.desc}</div>
               <div className="flex justify-center gap-1 md:gap-2 text-[9px] md:text-[10px] font-mono font-bold">
                  {act.hunger !== 0 && (
                      <span className={act.isGain ? 'text-green-500' : (player.hunger < act.hunger && !adminNoCost ? 'text-red-600 animate-pulse' : 'text-orange-500')}>
                         {act.isGain ? '+' : '-'}{Math.abs(adminNoCost ? 0 : act.hunger)}H
                      </span>
                  )}
                  {act.fatigue !== 0 && (
                      <span className={act.isGain ? 'text-green-500' : (player.fatigue < act.fatigue && !adminNoCost ? 'text-red-600 animate-pulse' : 'text-blue-500')}>
                         {act.isGain ? '+' : '-'}{Math.abs(adminNoCost ? 0 : act.fatigue)}F
                      </span>
                  )}
               </div>
            </div>
            {/* @ts-ignore */}
            {act.cooldown && act.cooldown > 0 && !adminNoCost && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-md backdrop-blur-[1px]">
                  <span className="text-xs md:text-sm font-bold text-white font-mono">CD: {act.cooldown}d</span>
                </div>
            )}
            {/* Stun Overlay */}
            {isBlockedByStun && !adminNoCost && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-md backdrop-blur-[1px] z-20">
                  <span className="text-xs md:text-sm font-bold text-red-500 font-mono">STUNNED</span>
                </div>
            )}
            {/* Lockdown Overlay */}
            {/* @ts-ignore */}
            {act.disabledCondition && isLockdown && !adminNoCost && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-md backdrop-blur-[1px] z-20 border border-red-900/50">
                  <span className="text-xs md:text-sm font-bold text-red-500 font-mono">LOCKED</span>
                </div>
            )}
            {isActive && (
                <div className={`absolute -bottom-2 w-10 md:w-12 h-1 ${act.color.replace('text', 'bg')} rounded-full shadow-lg`}></div>
            )}
          </button>
        );
      })}

      {/* SEPARATOR */}
      <div className="w-px h-12 md:h-16 bg-gray-800 mx-0.5 md:mx-1"></div>

      {/* BAG BUTTON */}
      <button 
        onClick={handleOpenBag}
        className="h-24 w-14 md:h-28 md:w-16 border-2 border-gray-800 bg-gray-900 rounded-lg flex flex-col items-center justify-center hover:bg-gray-800 hover:border-gray-600 transition-all group shrink-0 hover:-translate-y-1 cursor-pointer relative"
      >
        <div className="relative">
            <Backpack size={20} className="text-gray-500 mb-1 md:mb-2 group-hover:text-yellow-500 md:hidden" />
            <Backpack size={24} className="text-gray-500 mb-2 group-hover:text-yellow-500 hidden md:block" />
            {hasNewItems && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-500 rounded-full border border-gray-900"></div>
            )}
        </div>
        <span className="text-[9px] md:text-[10px] font-mono text-gray-400 tracking-widest group-hover:text-white">BAG</span>
      </button>
    </div>
  );
};

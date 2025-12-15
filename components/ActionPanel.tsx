import React from 'react';
import { ActionType, Player, PlayerStatus, Phase } from '../types';
import { Sword, Shield, Wind, Utensils, Moon } from 'lucide-react';
import { GAME_CONFIG } from '../constants';

interface ActionPanelProps {
  player: Player | undefined;
  phase: Phase;
  pendingAction: { type: ActionType, targetId?: string | null };
  onActionSelect: (type: ActionType) => void;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({ 
  player, 
  phase, 
  pendingAction,
  onActionSelect 
}) => {
  if (!player || player.status === PlayerStatus.DEAD) return (
    <div className="h-full flex items-center justify-center text-red-500 font-mono text-lg border-t border-gray-800 bg-gray-900">
      YOU ARE DEAD. SPECTATOR MODE ACTIVE.
    </div>
  );

  const isDay = phase === Phase.DAY;
  const isStunned = player.status === PlayerStatus.STUNNED;

  const buttons = [
    {
      type: ActionType.ATTACK,
      label: 'ATTACK',
      icon: <Sword size={18} />,
      cost: `H:-${GAME_CONFIG.COST_ATTACK_HUNGER} F:-${GAME_CONFIG.COST_ATTACK_FATIGUE}`,
      desc: '30-40 DMG',
      disabled: false,
      color: 'hover:bg-red-900/50 border-red-900/50 text-red-400'
    },
    {
      type: ActionType.DEFEND,
      label: 'DEFEND',
      icon: <Shield size={18} />,
      cost: `H:-${GAME_CONFIG.COST_DEFEND_HUNGER} F:-${GAME_CONFIG.COST_DEFEND_FATIGUE}`,
      desc: 'Reduce DMG',
      disabled: false,
      color: 'hover:bg-blue-900/50 border-blue-900/50 text-blue-400'
    },
    {
      type: ActionType.RUN,
      label: 'RUN',
      icon: <Wind size={18} />,
      cost: `H:-${GAME_CONFIG.COST_RUN_HUNGER} F:-${GAME_CONFIG.COST_RUN_FATIGUE}`,
      desc: 'Avoid Atk',
      disabled: player.cooldowns.run > 0,
      cooldown: player.cooldowns.run,
      color: 'hover:bg-green-900/50 border-green-900/50 text-green-400'
    },
    {
      type: ActionType.EAT,
      label: 'EAT',
      icon: <Utensils size={18} />,
      cost: `H:+${GAME_CONFIG.EAT_REGEN}`,
      desc: `+${GAME_CONFIG.EAT_HP_REGEN} HP`,
      disabled: player.cooldowns.eat > 0,
      cooldown: player.cooldowns.eat,
      color: 'hover:bg-orange-900/50 border-orange-900/50 text-orange-400'
    },
    {
      type: ActionType.REST,
      label: 'REST',
      icon: <Moon size={18} />,
      cost: `F:+${GAME_CONFIG.REST_REGEN}`,
      desc: `+${GAME_CONFIG.REST_HP_REGEN} HP`,
      disabled: player.cooldowns.rest > 0,
      cooldown: player.cooldowns.rest,
      color: 'hover:bg-purple-900/50 border-purple-900/50 text-purple-400'
    }
  ];

  return (
    <div className="bg-gray-900 border-t border-gray-800 p-4">
      <div className="flex items-center justify-between mb-2">
         <h3 className="text-gray-400 text-sm font-mono tracking-wider">ACTION PROTOCOLS</h3>
         {isStunned && <span className="text-purple-500 font-bold animate-pulse">UNIT STUNNED - ACTIONS LOCKED</span>}
         {!isDay && !isStunned && <span className="text-yellow-500 text-sm">NIGHT PHASE - EXECUTION IN PROGRESS</span>}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {buttons.map((btn) => {
          const isActive = pendingAction.type === btn.type;
          const isDisabled = !isDay || isStunned || btn.disabled;
          
          return (
            <button
              key={btn.type}
              onClick={() => onActionSelect(btn.type)}
              disabled={isDisabled}
              className={`
                relative flex flex-col items-center justify-center p-3 rounded-lg border 
                transition-all duration-150
                ${btn.color}
                ${isActive ? 'bg-opacity-100 ring-2 ring-white/20 scale-95 border-white/50' : 'bg-opacity-0 border-opacity-30'}
                ${isDisabled ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:scale-105 active:scale-95'}
              `}
            >
              <div className="mb-1">{btn.icon}</div>
              <span className="font-bold text-sm tracking-wider">{btn.label}</span>
              <span className="text-[10px] opacity-70 mt-1 font-mono">{btn.cost}</span>
              <span className="text-[9px] text-gray-300 mt-0.5">{btn.desc}</span>
              
              {btn.cooldown && btn.cooldown > 0 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg backdrop-blur-sm">
                   <span className="text-xl font-bold text-white">{btn.cooldown}d</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      <div className="mt-2 text-center h-5">
        {pendingAction.type !== ActionType.NONE && isDay && (
           <span className="text-xs text-gray-500 animate-pulse">
             {pendingAction.type === ActionType.ATTACK ? "SELECT TARGET FROM GRID" : "ACTION LOCKED - AWAITING NIGHT"}
           </span>
        )}
      </div>
    </div>
  );
};
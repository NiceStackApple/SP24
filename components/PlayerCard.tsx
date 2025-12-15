import React, { useEffect, useState } from 'react';
import { Player, PlayerStatus, BattleEvent, ActionType } from '../types';
import { Heart, Utensils, Zap, Skull, Shield, ZapOff } from 'lucide-react';
import { GAME_CONFIG } from '../constants';

interface PlayerCardProps {
  player: Player;
  isMe: boolean;
  isSelected: boolean;
  activeEvent: BattleEvent | null;
  onSelect: (id: string) => void;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, isMe, isSelected, activeEvent, onSelect }) => {
  const isDead = player.status === PlayerStatus.DEAD;
  const isStunned = player.status === PlayerStatus.STUNNED;
  const hpPercent = (player.hp / GAME_CONFIG.START_HP) * 100;
  
  let hpColor = 'bg-green-500';
  if (hpPercent < 50) hpColor = 'bg-yellow-500';
  if (hpPercent < 20) hpColor = 'bg-red-500';

  // Animation States
  const [highlight, setHighlight] = useState(false);
  const [triggerHit, setTriggerHit] = useState(false);

  useEffect(() => {
    if (!activeEvent) {
      setHighlight(false);
      setTriggerHit(false);
      return;
    }

    // Phase 1: Pre-Highlight (Immediate)
    if (activeEvent.sourceId === player.id || activeEvent.targetId === player.id) {
       setHighlight(true);
    }

    // Phase 2: Impact (Delayed to sync with sword animation)
    const timer = setTimeout(() => {
       setTriggerHit(true);
    }, 600); // Syncs with useGameEngine delay

    return () => clearTimeout(timer);
  }, [activeEvent, player.id]);

  // Derived visuals
  let animClass = '';
  let floatText = null;
  let showSlash = false;

  // Source Visuals (Immediate or Impact)
  if (activeEvent?.sourceId === player.id) {
     if (triggerHit) {
        if (activeEvent.type === ActionType.RUN && !activeEvent.isMiss) {
           animClass = 'opacity-50 translate-x-[50px] transition-all duration-500';
           floatText = { text: "DODGED", color: "text-blue-400" };
        }
        if (activeEvent.type === ActionType.DEFEND) floatText = { text: "DEFENDING", color: "text-blue-500" };
        if (activeEvent.type === ActionType.EAT) floatText = { text: "+EAT", color: "text-green-400" };
        if (activeEvent.type === ActionType.REST) floatText = { text: "+REST", color: "text-purple-400" };
     }
  }

  // Target Visuals (Only after Hit Trigger)
  if (activeEvent?.targetId === player.id && triggerHit) {
     if (activeEvent.type === ActionType.ATTACK) {
       if (activeEvent.isMiss) {
         animClass = 'translate-x-4 skew-x-12 transition-transform duration-200';
         floatText = { text: "DODGED", color: "text-blue-400 font-bold" };
       } else if (activeEvent.isBlocked) {
         animClass = 'animate-pulse';
         floatText = { text: `BLOCKED -${activeEvent.value}`, color: "text-blue-300" };
       } else {
         showSlash = true;
         animClass = 'animate-bounce bg-red-900/50';
         floatText = { text: `-${activeEvent.value}`, color: "text-red-500 font-bold text-xl" };
       }
     }
  }

  return (
    <div 
      id={`player-card-${player.id}`}
      onClick={() => !isDead && !isMe && onSelect(player.id)}
      className={`
        relative p-2 rounded-lg border transition-all duration-200 cursor-pointer overflow-visible
        ${isMe ? 'border-yellow-400 bg-yellow-900/20' : ''}
        ${isSelected ? 'border-red-500 ring-2 ring-red-500/50 scale-105 z-10' : 'border-gray-800 bg-gray-900/50 hover:border-gray-600'}
        ${isDead ? 'opacity-50 grayscale' : ''}
        ${highlight ? (activeEvent?.sourceId === player.id ? 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]') : ''}
        ${animClass}
      `}
    >
      {/* Floating Action Text */}
      {floatText && (
        <div className={`absolute -top-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none whitespace-nowrap animate-bounce ${floatText.color} font-mono font-bold text-shadow-md`}>
          {floatText.text}
        </div>
      )}

      {/* Slash Effect Overlay */}
      {showSlash && (
        <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden rounded-lg">
           <div className="absolute top-1/2 left-1/2 w-[150%] h-2 bg-white -translate-x-1/2 -translate-y-1/2 rotate-45 shadow-[0_0_10px_#fff,0_0_20px_#f00] animate-pulse opacity-80" />
        </div>
      )}

      {/* Action Overlay Icons */}
      {activeEvent?.targetId === player.id && activeEvent.isBlocked && triggerHit && (
         <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
           <Shield className="text-blue-500 w-12 h-12 drop-shadow-lg opacity-80" />
         </div>
      )}

      <div className="flex items-center space-x-2 mb-2">
        <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex-shrink-0 border border-gray-600">
          <img 
            src={`https://picsum.photos/seed/${player.avatarId}/200`} 
            alt="avatar" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold truncate ${isMe ? 'text-yellow-400' : 'text-gray-200'}`}>
            {player.name}
          </p>
          <div className="flex items-center space-x-1 text-[10px] text-gray-500">
             {isDead ? <span className="text-red-600 font-bold">DECEASED</span> : 
              isStunned ? <span className="text-purple-400 font-bold flex items-center"><ZapOff size={10} className="mr-1"/> STUNNED</span> :
              <span className="text-green-500">ALIVE</span>
             }
             {isMe && <span className="ml-1 text-yellow-500 font-bold">[YOU]</span>}
          </div>
        </div>
      </div>

      {!isDead && (
        <div className="space-y-1.5">
          {/* HP Bar */}
          <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden border border-gray-700">
            <div className={`h-full ${hpColor} transition-all duration-300`} style={{ width: `${Math.max(0, hpPercent)}%` }} />
          </div>
          
          <div className="flex justify-between text-[10px] text-gray-400 font-mono">
            <div className="flex items-center space-x-0.5" title="HP">
              <Heart size={10} className="text-red-400" />
              <span>{player.hp}</span>
            </div>
            <div className="flex items-center space-x-0.5" title="Hunger">
              <Utensils size={10} className="text-orange-400" />
              <span>{player.hunger}</span>
            </div>
            <div className="flex items-center space-x-0.5" title="Fatigue">
              <Zap size={10} className="text-blue-400" />
              <span>{player.fatigue}</span>
            </div>
          </div>
        </div>
      )}

      {player.incomingAttacks.length > 0 && !activeEvent && (
           <div className="absolute top-0 right-0 animate-pulse text-red-500 bg-red-900/80 rounded-full p-1 shadow-lg border border-red-500 z-10">
             <Shield size={12} />
           </div>
      )}

      {isDead && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 pointer-events-none rounded-lg z-10">
          <Skull className="text-red-600 opacity-80 animate-pulse" size={32} />
        </div>
      )}
    </div>
  );
};
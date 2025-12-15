import React from 'react';
import { GameState, ActionType, Phase } from '../types';
import { PlayerCard } from './PlayerCard';
import { ActionPanel } from './ActionPanel';
import { GameLog } from './GameLog';
import { ChatPanel } from './ChatPanel';
import { BattleAnimationLayer } from './BattleAnimationLayer';
import { Clock, Sun, Moon, Eye } from 'lucide-react';

interface GameBoardProps {
  state: GameState;
  pendingAction: { type: ActionType, targetId?: string | null };
  onActionSelect: (type: ActionType, targetId?: string) => void;
  onSendMessage: (text: string, recipient?: string) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ 
  state, 
  pendingAction, 
  onActionSelect,
  onSendMessage
}) => {
  const me = state.players.find(p => p.id === state.myPlayerId);
  const isDay = state.phase === Phase.DAY;
  
  const handlePlayerClick = (targetId: string) => {
    if (pendingAction.type === ActionType.ATTACK) {
      onActionSelect(ActionType.ATTACK, targetId);
    }
  };

  const aliveCount = state.players.filter(p => p.status === 'ALIVE').length;

  return (
    <div className="h-screen w-full flex flex-col bg-gray-950 text-gray-200 overflow-hidden">
      <BattleAnimationLayer event={state.currentEvent} />

      {/* Top Bar */}
      <header className="h-16 bg-black border-b border-gray-800 flex items-center justify-between px-6 shrink-0 z-20 shadow-lg">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold tracking-tighter text-white">SP:24</h1>
          <div className="h-8 w-px bg-gray-800"></div>
          <div className="flex items-center space-x-2 font-mono text-xl">
            {isDay ? <Sun className="text-yellow-500" /> : <Moon className="text-blue-500 animate-pulse" />}
            <span className={isDay ? 'text-yellow-100' : 'text-blue-100'}>
              DAY {state.day}
            </span>
          </div>
          <div className={`
             flex items-center space-x-2 px-3 py-1 rounded font-mono font-bold
             ${isDay && state.timeLeft <= 10 ? 'bg-red-900/50 text-red-500 animate-pulse' : 'bg-gray-900 text-gray-300'}
             ${!isDay ? 'text-blue-400' : ''}
          `}>
            {isDay ? <Clock size={16} /> : <Eye size={16} />}
            <span>{isDay ? `00:${state.timeLeft.toString().padStart(2, '0')}` : 'RESOLVING...'}</span>
          </div>
        </div>

        <div className="flex items-center space-x-6 text-sm font-mono text-gray-500">
           <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase">Survivors</span>
              <span className="text-white text-xl leading-none">{aliveCount}<span className="text-gray-600">/24</span></span>
           </div>
           {me && (
             <div className="flex space-x-4 border-l border-gray-800 pl-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase">Hunger</span>
                  <span className={`text-lg leading-none ${me.hunger < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{me.hunger}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase">Fatigue</span>
                  <span className={`text-lg leading-none ${me.fatigue < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{me.fatigue}</span>
                </div>
             </div>
           )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Night Overlay */}
        {!isDay && (
          <div className="absolute inset-0 bg-blue-900/10 pointer-events-none z-0 mix-blend-overlay"></div>
        )}

        {/* Left: Player Grid */}
        <div className={`flex-1 overflow-y-auto p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] ${isDay ? 'from-gray-900 to-black' : 'from-gray-950 to-black'} transition-colors duration-1000`}>
          {/* Grid optimized for 24 players: 4 cols on small, 6 on med/large */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 pb-20 max-w-7xl mx-auto">
            {state.players.map(player => (
              <PlayerCard 
                key={player.id} 
                player={player} 
                isMe={player.id === state.myPlayerId}
                isSelected={pendingAction.targetId === player.id}
                activeEvent={state.currentEvent}
                onSelect={handlePlayerClick}
              />
            ))}
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="w-80 border-l border-gray-800 bg-black flex flex-col shrink-0 z-10 shadow-xl">
          <div className="flex-1 p-2 min-h-0 bg-gray-900/50">
            <GameLog logs={state.logs} />
          </div>
          <div className="h-1/3 p-2 min-h-[200px] border-t border-gray-800">
            <ChatPanel 
              messages={state.messages} 
              players={state.players} 
              onSendMessage={onSendMessage} 
              myId={state.myPlayerId}
            />
          </div>
        </div>
      </div>

      {/* Bottom: Action Panel */}
      <div className="shrink-0 z-30">
        <ActionPanel 
          player={me} 
          phase={state.phase} 
          pendingAction={pendingAction} 
          onActionSelect={(type) => onActionSelect(type, null)} 
        />
      </div>

      {/* Game Over Overlay */}
      {state.phase === Phase.GAME_OVER && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm">
           <h2 className="text-7xl font-bold text-white mb-6 tracking-tighter">GAME OVER</h2>
           {state.winnerId === state.myPlayerId ? (
             <div className="text-5xl text-yellow-500 font-mono mb-8 animate-pulse text-center">
               MISSION ACCOMPLISHED<br/>
               <span className="text-lg text-white tracking-widest mt-2 block">SOLE SURVIVOR</span>
             </div>
           ) : (
             <div className="text-5xl text-red-600 font-mono mb-8 text-center">
               ELIMINATED<br/>
               <span className="text-lg text-gray-500 tracking-widest mt-2 block">BETTER LUCK NEXT CYCLE</span>
             </div>
           )}
           <p className="text-gray-600 mb-8 font-mono">Refreshes automatically...</p>
           <button 
             onClick={() => window.location.reload()}
             className="px-10 py-4 bg-white text-black font-bold text-xl rounded hover:scale-105 transition-transform"
           >
             NEW SIMULATION
           </button>
        </div>
      )}
    </div>
  );
};
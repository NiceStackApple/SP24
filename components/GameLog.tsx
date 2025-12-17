
import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { Terminal } from 'lucide-react';

interface GameLogProps {
  logs: LogEntry[];
  myPlayerId?: string | null;
}

export const GameLog: React.FC<GameLogProps> = ({ logs, myPlayerId }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLogColor = (type: LogEntry['type']) => {
      switch(type) {
          case 'damage': return 'text-orange-500 font-bold';
          case 'defense': return 'text-cyan-300';
          case 'heal': return 'text-green-400';
          case 'rest': return 'text-purple-400';
          case 'eat': return 'text-yellow-400';
          case 'item': return 'text-blue-400';
          case 'death': return 'text-red-600 font-bold uppercase tracking-wider';
          case 'system': return 'text-blue-400 font-bold';
          default: return 'text-gray-400';
      }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="bg-black/50 p-3 border-b border-gray-800 flex items-center gap-2">
        <Terminal size={14} className="text-gray-400" />
        <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest">Activity Log</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-xs custom-scrollbar">
        {logs.length === 0 && <div className="text-gray-700 italic text-center mt-4">Monitoring arena events...</div>}
        {logs.map((log) => {
          const isInvolved = myPlayerId && log.involvedIds?.includes(myPlayerId);
          const colorClass = getLogColor(log.type);
          
          return (
            <div 
               key={log.id} 
               className={`flex items-start gap-3 animate-fade-in border-l-2 pl-3 py-1 transition-colors
                  ${isInvolved ? 'border-yellow-500 bg-yellow-900/10' : 'border-transparent hover:border-gray-800'}
               `}
            >
               <span className="text-gray-600 shrink-0 select-none font-bold">[{log.day.toString().padStart(2, '0')}]</span>
               <span className={`leading-relaxed tracking-wide ${colorClass}`}>
                 {log.text}
               </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

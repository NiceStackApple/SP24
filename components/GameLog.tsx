import React, { useEffect, useRef, useContext } from 'react';
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

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="bg-black/50 p-3 border-b border-gray-800 flex items-center gap-2">
        <Terminal size={14} className="text-gray-400" />
        <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest">Activity Log</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
        {logs.length === 0 && <div className="text-gray-700 italic text-center mt-4">Monitoring arena events...</div>}
        {logs.map((log) => {
          const isInvolved = myPlayerId && log.involvedIds?.includes(myPlayerId);
          
          return (
            <div 
               key={log.id} 
               className={`flex items-start space-x-2 animate-fade-in border-l-2 pl-2 transition-colors py-0.5
                  ${isInvolved ? 'border-blue-500 bg-blue-900/10' : 'border-transparent hover:border-gray-800'}
               `}
            >
               <span className="text-gray-600 shrink-0 select-none">[{log.day.toString().padStart(2, '0')}]</span>
               <span className={`
                 leading-relaxed
                 ${log.type === 'death' ? 'text-red-500 font-bold' : ''}
                 ${log.type === 'combat' && !isInvolved ? 'text-yellow-100' : ''}
                 ${isInvolved ? 'text-blue-300 font-bold' : ''}
                 ${log.type === 'system' ? 'text-blue-400 font-bold w-full' : ''}
                 ${log.type === 'info' && !isInvolved ? 'text-gray-500' : ''}
               `}>
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
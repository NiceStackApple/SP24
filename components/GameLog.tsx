import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface GameLogProps {
  logs: LogEntry[];
}

export const GameLog: React.FC<GameLogProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-black/40 border border-gray-800 rounded-lg overflow-hidden">
      <div className="bg-gray-900/80 p-2 border-b border-gray-800">
        <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest">Battle Log</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-sm">
        {logs.length === 0 && <div className="text-gray-600 italic text-center mt-10">Waiting for battle data...</div>}
        {logs.map((log) => (
          <div key={log.id} className="flex items-start space-x-2 animate-fade-in">
             <span className="text-gray-600 text-xs mt-0.5">[{log.day}]</span>
             <span className={`
               ${log.type === 'death' ? 'text-red-500 font-bold' : ''}
               ${log.type === 'combat' ? 'text-yellow-200' : ''}
               ${log.type === 'system' ? 'text-blue-400 font-bold border-b border-blue-900 pb-1 mb-1 block w-full' : ''}
               ${log.type === 'info' ? 'text-gray-400' : ''}
             `}>
               {log.text}
             </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
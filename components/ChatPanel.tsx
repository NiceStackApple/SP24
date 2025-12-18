
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, Player, PlayerStatus } from '../types';
import { Send, MessageSquare, Lock, ChevronDown, Clock } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  players: Player[];
  onSendMessage: (text: string, recipientId?: string) => void;
  myId: string | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, players, onSendMessage, myId }) => {
  const [input, setInput] = useState('');
  const [lastSent, setLastSent] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [targetId, setTargetId] = useState<string>('GLOBAL');
  const bottomRef = useRef<HTMLDivElement>(null);
  
  const me = players.find(p => p.id === myId);
  const isDead = me?.status === PlayerStatus.DEAD;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cooldown Timer
  useEffect(() => {
    if (cooldown > 0) {
       const timer = setInterval(() => {
          setCooldown(prev => Math.max(0, prev - 1));
       }, 1000);
       return () => clearInterval(timer);
    }
  }, [cooldown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || cooldown > 0 || isDead) return;

    const now = Date.now();
    if (now - lastSent < 5000) { return; }

    onSendMessage(input, targetId === 'GLOBAL' ? undefined : targetId);
    setInput('');
    setLastSent(now);
    setCooldown(5);
  };

  const visibleMessages = messages.filter(msg => {
    if (!msg.isWhisper) return true;
    return msg.senderId === myId || msg.recipientId === myId;
  });

  const validTargets = players.filter(p => p.id !== myId && p.status === PlayerStatus.ALIVE);

  return (
    <div className="flex flex-col h-full bg-gray-950/50 relative">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 font-mono text-[10px] md:text-xs scrollbar-hide relative">
        {isDead && (
             <div className="sticky top-0 z-10 bg-red-900/20 text-red-400 text-[9px] p-1 text-center rounded mb-1 border border-red-900/50 backdrop-blur-sm">
                CONNECTION LOST
             </div>
        )}
        
        {visibleMessages.length === 0 && (
           <div className="text-center text-gray-700 text-[9px] italic mt-4">
              Channel secure.
           </div>
        )}
        
        {visibleMessages.map((msg) => {
           const isMe = msg.senderId === myId;
           const isWhisper = msg.isWhisper;
           
           return (
            <div 
               key={msg.id} 
               className={`break-words leading-tight animate-fade-in ${isWhisper ? 'bg-blue-900/10 -mx-1 px-1 py-0.5 rounded border-l border-blue-500/50' : ''}`}
            >
              <div className="flex flex-wrap items-baseline gap-1">
                {isWhisper && <Lock size={8} className="text-blue-400" />}
                <span className={`font-bold whitespace-nowrap ${isMe ? 'text-yellow-500' : 'text-blue-400'}`}>
                  {msg.senderName}
                  {isWhisper ? ':' : ':'}
                </span>
                <span className={`text-gray-300 ${isWhisper ? 'italic text-blue-100' : ''}`}>{msg.text}</span>
              </div>
            </div>
           );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input Area - Compact for Split View */}
      <div className="p-1 md:p-2 bg-black/50 border-t border-gray-800 shrink-0">
         <div className="flex items-center gap-1 mb-1">
             <div className="relative group flex-1">
                <select 
                   value={targetId}
                   onChange={(e) => setTargetId(e.target.value)}
                   disabled={isDead}
                   className="w-full bg-gray-900 text-[10px] text-gray-400 border border-gray-700 rounded px-1 py-1 appearance-none focus:outline-none focus:border-yellow-600 disabled:opacity-50"
                >
                   <option value="GLOBAL">ALL</option>
                   {validTargets.map(p => (
                      <option key={p.id} value={p.id}>@{p.name}</option>
                   ))}
                </select>
                <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                   <ChevronDown size={10} />
                </div>
             </div>
             {cooldown > 0 && <span className="text-[9px] text-orange-500 font-mono">{cooldown}s</span>}
         </div>

         <form onSubmit={handleSubmit} className="flex gap-1">
            <input 
               type="text" 
               value={input}
               onChange={(e) => setInput(e.target.value)}
               maxLength={100}
               placeholder={isDead ? "..." : "Msg..."}
               disabled={isDead || cooldown > 0}
               className="flex-1 bg-gray-900 text-gray-200 text-xs px-2 py-1 rounded border border-gray-800 focus:outline-none focus:border-yellow-600 min-w-0"
            />
            <button 
               type="submit" 
               disabled={!input.trim() || isDead || cooldown > 0}
               className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-400 hover:text-white px-2 rounded flex items-center justify-center border border-gray-700"
            >
               <Send size={12} />
            </button>
         </form>
      </div>
    </div>
  );
};

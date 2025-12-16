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
    // 5 Second Cooldown
    if (now - lastSent < 5000) {
      return;
    }

    onSendMessage(input, targetId === 'GLOBAL' ? undefined : targetId);
    setInput('');
    setLastSent(now);
    setCooldown(5);
  };

  // Filter messages based on privacy
  const visibleMessages = messages.filter(msg => {
    if (!msg.isWhisper) return true;
    return msg.senderId === myId || msg.recipientId === myId;
  });

  const validTargets = players.filter(p => p.id !== myId && p.status === PlayerStatus.ALIVE);

  return (
    <div className="flex flex-col h-full bg-gray-950 border-b border-gray-800 relative">
      {/* Header */}
      <div className="bg-black/50 p-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <MessageSquare size={14} className="text-gray-400" />
           <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest">Comms</h3>
        </div>
        {cooldown > 0 && (
           <div className="flex items-center gap-1 text-[10px] text-orange-500 animate-pulse font-mono">
              <Clock size={10} />
              WAIT {cooldown}s
           </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm scrollbar-hide relative">
        {isDead && (
             <div className="sticky top-0 z-10 bg-red-900/20 text-red-400 text-xs p-2 text-center rounded mb-2 border border-red-900/50 backdrop-blur-sm">
                SYSTEM FAILURE: TRANSMISSION DISABLED
             </div>
        )}
        
        {visibleMessages.length === 0 && (
           <div className="text-center text-gray-700 text-xs italic mt-4">
              Channel secure. No chatter.
           </div>
        )}
        
        {visibleMessages.map((msg) => {
           const isMe = msg.senderId === myId;
           const isWhisper = msg.isWhisper;
           
           return (
            <div 
               key={msg.id} 
               className={`break-words leading-relaxed animate-fade-in ${isWhisper ? 'bg-blue-900/10 -mx-2 px-2 py-1 rounded border-l-2 border-blue-500/50' : ''}`}
            >
              <div className="flex items-baseline gap-1.5">
                {isWhisper && <Lock size={10} className="text-blue-400" />}
                <span className={`font-bold text-xs whitespace-nowrap ${isMe ? 'text-yellow-500' : 'text-blue-400'}`}>
                  {msg.senderName}
                  {isWhisper && msg.recipientName && !isMe && <span className="text-gray-500 font-normal"> to You</span>}
                  {isWhisper && msg.recipientName && isMe && <span className="text-gray-500 font-normal"> to {msg.recipientName}</span>}
                  :
                </span>
                <span className={`text-gray-300 ${isWhisper ? 'italic text-blue-100' : ''}`}>{msg.text}</span>
              </div>
            </div>
           );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-black border-t border-gray-800">
         {/* Target Selector */}
         <div className="flex items-center gap-2 mb-2">
             <div className="relative group flex-1">
                <select 
                   value={targetId}
                   onChange={(e) => setTargetId(e.target.value)}
                   disabled={isDead}
                   className="w-full bg-gray-900 text-xs text-gray-300 border border-gray-700 rounded px-2 py-1.5 appearance-none focus:outline-none focus:border-yellow-600 disabled:opacity-50 cursor-pointer"
                >
                   <option value="GLOBAL">GLOBAL CHANNEL</option>
                   {validTargets.map(p => (
                      <option key={p.id} value={p.id}>WHISPER: {p.name}</option>
                   ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                   <ChevronDown size={12} />
                </div>
             </div>
         </div>

         {/* Text Input */}
         <form onSubmit={handleSubmit} className="flex space-x-2 relative">
            <input 
               type="text" 
               value={input}
               onChange={(e) => setInput(e.target.value)}
               maxLength={100}
               placeholder={isDead ? "CONNECTION TERMINATED" : (targetId === 'GLOBAL' ? "Broadcast message..." : `Whisper to target...`)}
               disabled={isDead || cooldown > 0}
               className="flex-1 bg-gray-900 text-gray-200 text-sm px-3 py-2 rounded border border-gray-800 focus:outline-none focus:border-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button 
               type="submit" 
               disabled={!input.trim() || isDead || cooldown > 0}
               className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-400 hover:text-white p-2 rounded transition-colors"
            >
               <Send size={16} />
            </button>
            
            {/* Cooldown Overlay on Input */}
            {cooldown > 0 && (
               <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] rounded flex items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-mono text-orange-500 font-bold tracking-widest">RECHARGING ({cooldown}s)</span>
               </div>
            )}
         </form>
      </div>
    </div>
  );
};
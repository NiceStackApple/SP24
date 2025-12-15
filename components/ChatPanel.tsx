import React, { useState } from 'react';
import { ChatMessage, Player } from '../types';
import { Send } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  players: Player[];
  onSendMessage: (text: string, recipientId?: string) => void;
  myId: string | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, players, onSendMessage, myId }) => {
  const [input, setInput] = useState('');
  const [recipient, setRecipient] = useState<string>('all');
  const [lastSent, setLastSent] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const now = Date.now();
    if (now - lastSent < 5000) {
      alert("Chat cooldown active (5s)");
      return;
    }

    onSendMessage(input, recipient === 'all' ? undefined : recipient);
    setInput('');
    setLastSent(now);
  };

  const alivePlayers = players.filter(p => p.id !== myId && p.status !== 'DEAD');

  return (
    <div className="flex flex-col h-full bg-black/40 border border-gray-800 rounded-lg overflow-hidden">
      <div className="bg-gray-900/80 p-2 border-b border-gray-800 flex justify-between items-center">
        <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest">Comm Link</h3>
        <select 
          value={recipient} 
          onChange={(e) => setRecipient(e.target.value)}
          className="bg-gray-800 text-xs text-gray-300 border-none rounded px-1 py-0.5 focus:ring-1 focus:ring-yellow-500"
        >
          <option value="all">Global</option>
          {alivePlayers.map(p => (
            <option key={p.id} value={p.id}>Whisper: {p.name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-sm">
        {messages.map((msg) => {
           const isMe = msg.senderId === myId;
           return (
            <div key={msg.id} className={`break-words ${msg.isWhisper ? 'text-purple-400 italic' : 'text-gray-300'}`}>
              <span className={`font-bold ${isMe ? 'text-yellow-500' : 'text-blue-400'}`}>
                {msg.senderName}{msg.isWhisper && ' (whisper)'}:
              </span> {msg.text}
            </div>
           );
        })}
      </div>

      <form onSubmit={handleSubmit} className="p-2 bg-gray-900 border-t border-gray-800 flex space-x-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={100}
          placeholder="Transmit message..."
          className="flex-1 bg-gray-800 text-gray-200 text-sm px-3 py-1 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500"
        />
        <button 
          type="submit" 
          className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white p-1.5 rounded"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
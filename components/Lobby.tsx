import React, { useState } from 'react';
import { Play } from 'lucide-react';

interface LobbyProps {
  onStart: (name: string) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ onStart }) => {
  const [name, setName] = useState('');

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1598556776374-3382fab3e390?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>

      <div className="relative z-10 max-w-md w-full bg-gray-900/90 border border-gray-800 p-8 rounded-2xl shadow-2xl backdrop-blur-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold font-mono text-white mb-2 tracking-tighter">SURVIVAL<br/><span className="text-red-600">PROTOCOL: 48</span></h1>
          <p className="text-gray-400 font-mono text-sm">MULTIPLAYER STRATEGY SIMULATION</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-mono text-gray-500 mb-1">TRIBUTE NAME</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ENTER DESIGNATION"
              className="w-full bg-black/50 border border-gray-700 text-white px-4 py-3 rounded text-lg font-bold tracking-widest focus:outline-none focus:border-red-600 transition-colors"
              autoFocus
            />
          </div>

          <button 
            onClick={() => name && onStart(name)}
            disabled={!name}
            className={`
              w-full flex items-center justify-center space-x-2 py-4 rounded font-bold text-xl tracking-widest transition-all
              ${name ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/50' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
            `}
          >
            <span>ENTER ARENA</span>
            <Play size={20} fill="currentColor" />
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-800 text-center">
          <div className="text-[10px] text-gray-500 font-mono space-y-1">
             <p>SYSTEM STATUS: ONLINE</p>
             <p>PLAYERS CONNECTED: 1</p>
             <p>BOTS READY: 47</p>
          </div>
        </div>
      </div>
    </div>
  );
};
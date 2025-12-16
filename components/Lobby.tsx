import React, { useState, useEffect, useRef } from 'react';
import { Play, Users, Lock, User, X, Terminal, Globe, AlertTriangle } from 'lucide-react';
import { NAMES_LIST } from '../constants';

interface LobbyProps {
  onStart: (name: string, roomCode?: string, isHost?: boolean, roster?: string[]) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ onStart }) => {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'MENU' | 'CREATE' | 'JOIN'>('MENU');
  const [roomCode, setRoomCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [joinedPlayers, setJoinedPlayers] = useState<string[]>([]);
  
  // Global Log State
  const [globalLogs, setGlobalLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Host in Room
  useEffect(() => {
    if (mode === 'CREATE' && !generatedCode) {
      setGeneratedCode(Math.random().toString(36).substring(2, 7).toUpperCase());
      setJoinedPlayers([name]); 
    } else if (mode !== 'CREATE') {
      setJoinedPlayers([]);
      setGeneratedCode('');
    }
  }, [mode, name]);

  // Mock adding players (simulating others joining)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (mode === 'CREATE') {
       interval = setInterval(() => {
        setJoinedPlayers(prev => {
           if (prev.length >= 24) return prev;
           if (Math.random() > 0.7) { // Slower join rate
             const newName = NAMES_LIST[Math.floor(Math.random() * NAMES_LIST.length)] + "-" + (Math.floor(Math.random()*100));
             return [...prev, newName];
           }
           return prev;
        });
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [mode]);

  // Global Log Generator
  useEffect(() => {
      const feedMessages = [
          "Match #402 has started.",
          "Sector 7: Gas leak reported.",
          "Player-99 has been eliminated.",
          "Day 15: Night phase commencing in Match #389.",
          "Sector 4: Seismic activity detected.",
          "Match #403: Lobby full.",
          "System: Maintenance scheduled in 48h.",
          "Player-12 found a rare item.",
          "Match #390: Only 2 survivors remain.",
          "Warning: Zone shrinking in Sector 9.",
          "New High Score registered by Player-X.",
          "Match #404: Connection Established.",
          "A monster has been sighted in Arena B."
      ];

      const interval = setInterval(() => {
          if (Math.random() > 0.6) {
              const msg = feedMessages[Math.floor(Math.random() * feedMessages.length)];
              const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
              setGlobalLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
          }
      }, 2000);
      return () => clearInterval(interval);
  }, []);

  const handleKick = (playerToKick: string) => {
    setJoinedPlayers(prev => prev.filter(p => p !== playerToKick));
  };

  const handleStart = () => {
    if (!name) return;
    if (mode === 'CREATE') {
      onStart(name, generatedCode, true, joinedPlayers);
    } else if (mode === 'JOIN') {
      onStart(name, roomCode, false);
    } else {
      // Quick Play
      onStart(name, undefined, true);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1598556776374-3382fab3e390?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>

      <div className="relative z-10 max-w-7xl w-full flex gap-6">
        
        {/* Left Side: Update Log */}
        <div className="w-72 hidden xl:flex flex-col gap-4 h-[500px]">
             <div className="bg-gray-900/90 border border-gray-800 p-4 rounded-2xl shadow-2xl backdrop-blur-md flex-1 flex flex-col">
                 <div className="flex items-center gap-2 mb-4 border-b border-gray-800 pb-2">
                    <AlertTriangle size={14} className="text-yellow-500" />
                    <h3 className="text-gray-400 font-mono text-xs uppercase tracking-widest">SYSTEM UPDATES</h3>
                 </div>
                 <div className="flex-1 overflow-y-auto pr-2 space-y-4 font-mono text-xs text-gray-400 scrollbar-hide">
                    <div>
                       <div className="text-white font-bold mb-1 flex items-center justify-between">
                          <span>v2.1.0</span>
                          <span className="text-[10px] bg-red-900/30 text-red-500 px-1 rounded">LATEST</span>
                       </div>
                       <ul className="list-none space-y-1.5 text-gray-500">
                          <li className="flex gap-2">
                            <span className="text-red-500">-</span>
                            <span><b>ENDGAME:</b> Monster Hunt added.</span>
                          </li>
                          <li className="flex gap-2">
                            <span className="text-red-500">-</span>
                            <span><b>ZONE:</b> Shrinking barrier logic implemented.</span>
                          </li>
                       </ul>
                    </div>
                    
                    <div className="w-full h-px bg-gray-800/50 my-2"></div>

                    <div>
                       <div className="text-gray-300 font-bold mb-1">v2.0.5</div>
                       <ul className="list-none space-y-1.5 text-gray-500">
                          <li className="flex gap-2">
                            <span className="text-blue-500">-</span>
                            <span>Global Lobby Log enabled.</span>
                          </li>
                          <li className="flex gap-2">
                            <span className="text-blue-500">-</span>
                            <span>Pistol damage buffed (80-100).</span>
                          </li>
                       </ul>
                    </div>

                    <div className="w-full h-px bg-gray-800/50 my-2"></div>

                    <div>
                       <div className="text-gray-500 font-bold mb-1">v1.0.0</div>
                       <ul className="list-none space-y-1.5 text-gray-600">
                          <li className="flex gap-2">
                            <span>-</span>
                            <span>Initial deployment.</span>
                          </li>
                          <li className="flex gap-2">
                            <span>-</span>
                            <span>24 Tribute capacity.</span>
                          </li>
                       </ul>
                    </div>
                 </div>
             </div>
        </div>

        {/* Center: Controls */}
        <div className="flex-1 bg-gray-900/90 border border-gray-800 p-8 rounded-2xl shadow-2xl backdrop-blur-md h-fit min-h-[400px]">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold font-mono text-white mb-2 tracking-tighter">SURVIVAL<br/><span className="text-red-600">PROTOCOL: 24</span></h1>
            <p className="text-gray-400 font-mono text-sm">MULTIPLAYER STRATEGY SIMULATION</p>
          </div>

          {mode === 'MENU' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-gray-500 mb-1">TRIBUTE DESIGNATION</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ENTER NAME"
                  className="w-full bg-black/50 border border-gray-700 text-white px-4 py-3 rounded text-lg font-bold tracking-widest focus:outline-none focus:border-red-600 transition-colors text-center"
                  autoFocus
                />
              </div>

              <div className="pt-4 space-y-3">
                <button 
                  onClick={() => handleStart()}
                  disabled={!name}
                  className={`w-full py-4 rounded font-bold text-xl tracking-widest transition-all flex items-center justify-center space-x-2
                    ${name ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/50' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
                  `}
                >
                  <Play size={20} />
                  <span>QUICK PLAY</span>
                </button>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => name && setMode('CREATE')}
                    disabled={!name}
                    className={`flex-1 py-3 rounded font-bold text-sm tracking-widest border transition-all flex items-center justify-center space-x-2
                      ${name ? 'border-gray-600 hover:bg-gray-800 text-gray-300' : 'border-gray-800 text-gray-600 cursor-not-allowed'}
                    `}
                  >
                    <Users size={16} />
                    <span>CREATE ROOM</span>
                  </button>
                  <button 
                    onClick={() => name && setMode('JOIN')}
                    disabled={!name}
                    className={`flex-1 py-3 rounded font-bold text-sm tracking-widest border transition-all flex items-center justify-center space-x-2
                      ${name ? 'border-gray-600 hover:bg-gray-800 text-gray-300' : 'border-gray-800 text-gray-600 cursor-not-allowed'}
                    `}
                  >
                    <Lock size={16} />
                    <span>JOIN ROOM</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'CREATE' && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center border border-gray-700 bg-black/50 p-6 rounded-lg">
                <p className="text-gray-500 text-xs font-mono mb-2">PRIVATE ACCESS CODE</p>
                <div className="text-5xl font-mono text-yellow-500 tracking-[0.2em] font-bold mb-4">{generatedCode}</div>
                <div className="flex items-center justify-center space-x-2 text-gray-400">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                   <span className="text-xs font-mono">WAITING FOR PLAYERS: {joinedPlayers.length}/24</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setMode('MENU')}
                  className="flex-1 py-3 rounded font-bold text-sm tracking-widest border border-gray-600 hover:bg-gray-800 text-gray-400"
                >
                  CANCEL
                </button>
                <button 
                  onClick={handleStart}
                  className="flex-[2] py-3 rounded font-bold text-sm tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/50"
                >
                  START MATCH (FILL BOTS)
                </button>
              </div>
            </div>
          )}

          {mode === 'JOIN' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <label className="block text-xs font-mono text-gray-500 mb-1">ENTER ROOM CODE</label>
                <input 
                  type="text" 
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="XXXXX"
                  maxLength={5}
                  className="w-full bg-black/50 border border-gray-700 text-white px-4 py-3 rounded text-xl font-bold tracking-[0.5em] text-center focus:outline-none focus:border-yellow-500 transition-colors uppercase"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setMode('MENU')}
                  className="flex-1 py-3 rounded font-bold text-sm tracking-widest border border-gray-600 hover:bg-gray-800 text-gray-400"
                >
                  BACK
                </button>
                <button 
                  onClick={handleStart}
                  disabled={roomCode.length < 5}
                  className={`flex-[2] py-3 rounded font-bold text-sm tracking-widest transition-all
                    ${roomCode.length >= 5 ? 'bg-yellow-600 hover:bg-yellow-700 text-black' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
                  `}
                >
                  JOIN MATCH
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Player List OR Global Log */}
        {mode === 'CREATE' ? (
          <div className="w-80 bg-gray-900/90 border border-gray-800 p-4 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col h-[500px]">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-gray-400 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                  <Users size={14} />
                  Live Roster ({joinedPlayers.length})
               </h3>
               <span className="text-[10px] text-gray-600">BOTS WILL FILL EMPTY SLOTS ON START</span>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {joinedPlayers.map((player, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-black/40 p-3 rounded border border-gray-800 text-sm font-mono text-gray-300 animate-fade-in group">
                     <div className="flex items-center space-x-3">
                        <User size={14} className={idx === 0 ? "text-yellow-500" : "text-gray-600"} />
                        <span className="truncate max-w-[150px]">{player}</span>
                     </div>
                     {idx === 0 ? (
                        <span className="text-[10px] text-yellow-600 font-bold bg-yellow-900/20 px-2 py-0.5 rounded">HOST</span>
                     ) : (
                        <button 
                          onClick={() => handleKick(player)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-900/30 p-1 rounded transition-all"
                          title="Kick Player"
                        >
                          <X size={14} />
                        </button>
                     )}
                  </div>
                ))}
             </div>
          </div>
        ) : (
          <div className="w-80 bg-black/40 border border-gray-800 p-4 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col h-[500px]">
             <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                <h3 className="text-gray-400 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                   <Globe size={14} />
                   Global Network
                </h3>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             </div>
             
             <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 overflow-y-auto space-y-2 pr-2 scrollbar-hide" ref={logContainerRef}>
                   {globalLogs.map((log, idx) => (
                      <div key={idx} className="text-[10px] font-mono text-gray-500 border-l border-gray-800 pl-2 animate-fade-in">
                         {log}
                      </div>
                   ))}
                </div>
                {/* Scanline overlay */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 background-size-[100%_2px,3px_100%]"></div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
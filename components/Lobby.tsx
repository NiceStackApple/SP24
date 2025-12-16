
import React, { useState, useEffect } from 'react';
import { Play, Users, Lock, User, Trophy, FileText, LogOut } from 'lucide-react';
import { NAMES_LIST } from '../constants';
import { storageService } from '../services/storageService';
import { AccountModal } from './AccountModal';
import { AuthForms } from './AuthForms';
import { TipsChat } from './TipsChat';
import { UpdateLogModal } from './UpdateLogModal';
import { UserProfile } from '../types';

interface LobbyProps {
  onStart: (name: string, roomCode?: string, isHost?: boolean, roster?: string[]) => void;
}

// Mock Leaderboard Data Generator
const generateLeaderboard = () => {
  const data = [];
  const topNames = ["Cato", "Thresh", "Foxface", "Gloss", "Enobaria", "Brutus", "Finnick", "Johanna", "Peeta", "Gale"];
  
  for(let i = 0; i < 10; i++) {
     data.push({
         rank: i + 1,
         name: topNames[i] || `Player-${i}`,
         wins: Math.floor(50 - (i * 4) + Math.random() * 5),
         kills: Math.floor(300 - (i * 25) + Math.random() * 20),
         avatarId: i
     });
  }
  return data;
};

export const Lobby: React.FC<LobbyProps> = ({ onStart }) => {
  const [mode, setMode] = useState<'MENU' | 'CREATE' | 'JOIN'>('MENU');
  const [roomCode, setRoomCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [joinedPlayers, setJoinedPlayers] = useState<string[]>([]);
  const [leaderboardData] = useState(generateLeaderboard());
  const [showProfile, setShowProfile] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  
  // Auth State
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    // Check session
    const currentUser = storageService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
  }, []);

  const handleLoginSuccess = () => {
    const u = storageService.getCurrentUser();
    setUser(u);
  };

  const handleLogout = () => {
    storageService.logout();
    setUser(null);
    setMode('MENU');
  };

  // Initialize Host in Room
  useEffect(() => {
    if (mode === 'CREATE' && !generatedCode && user) {
      setGeneratedCode(Math.random().toString(36).substring(2, 7).toUpperCase());
      setJoinedPlayers([user.name]); 
    } else if (mode !== 'CREATE') {
      setJoinedPlayers([]);
      setGeneratedCode('');
    }
  }, [mode, user]);

  // Mock adding players
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (mode === 'CREATE') {
       interval = setInterval(() => {
        setJoinedPlayers(prev => {
           if (prev.length >= 24) return prev;
           if (Math.random() > 0.7) { 
             const newName = NAMES_LIST[Math.floor(Math.random() * NAMES_LIST.length)] + "-" + (Math.floor(Math.random()*100));
             return [...prev, newName];
           }
           return prev;
        });
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [mode]);

  const handleStart = () => {
    if (!user) return;
    
    if (mode === 'CREATE') {
      onStart(user.name, generatedCode, true, joinedPlayers);
    } else if (mode === 'JOIN') {
      onStart(user.name, roomCode, false);
    } else {
      // Quick Play
      onStart(user.name, undefined, true);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1598556776374-3382fab3e390?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>

      <AccountModal 
        isOpen={showProfile} 
        onClose={() => setShowProfile(false)} 
        onNameUpdate={(newName) => setUser(prev => prev ? { ...prev, name: newName } : null)} 
      />

      <UpdateLogModal 
        isOpen={showUpdates}
        onClose={() => setShowUpdates(false)}
      />

      <div className="relative z-10 max-w-7xl w-full flex gap-6">
        
        {/* Left Side: Leaderboard */}
        <div className="w-80 hidden xl:flex flex-col gap-4 h-[600px]">
             <div className="bg-gray-900/90 border border-gray-800 p-4 rounded-2xl shadow-2xl backdrop-blur-md flex-1 flex flex-col">
                 <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                    <div className="flex items-center gap-2">
                        <Trophy size={14} className="text-yellow-500" />
                        <h3 className="text-gray-400 font-mono text-xs uppercase tracking-widest">ELITE LEADERBOARD</h3>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 </div>
                 
                 <div className="flex-1 overflow-hidden relative">
                    <div className="absolute inset-0 overflow-y-auto pr-1 scrollbar-hide space-y-2">
                        <div className="flex text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-2 px-2">
                            <span className="w-8">#</span>
                            <span className="flex-1">Operative</span>
                            <span className="w-12 text-center">Wins</span>
                            <span className="w-12 text-center">Kills</span>
                        </div>

                        {leaderboardData.map((entry) => (
                           <div key={entry.rank} className="flex items-center bg-black/40 border border-gray-800 rounded p-2 text-xs font-mono group hover:bg-gray-800 transition-colors">
                               <span className={`w-8 font-bold ${entry.rank === 1 ? 'text-yellow-500' : (entry.rank <= 3 ? 'text-gray-300' : 'text-gray-600')}`}>
                                  {entry.rank}
                               </span>
                               <div className="flex-1 flex items-center gap-2 min-w-0">
                                   <div className="w-4 h-4 rounded bg-gray-700 overflow-hidden shrink-0">
                                      <img src={`https://picsum.photos/seed/${entry.avatarId}/50`} className="w-full h-full object-cover opacity-80" alt="av" />
                                   </div>
                                   <span className="text-gray-300 truncate font-bold group-hover:text-white">{entry.name}</span>
                               </div>
                               <span className="w-12 text-center text-yellow-600 font-bold">{entry.wins}</span>
                               <span className="w-12 text-center text-red-800 font-bold">{entry.kills}</span>
                           </div>
                        ))}
                    </div>
                 </div>
             </div>
        </div>

        {/* Center: Controls */}
        <div className="flex-1 bg-gray-900/90 border border-gray-800 p-8 rounded-2xl shadow-2xl backdrop-blur-md h-fit min-h-[500px] flex flex-col">
          <div className="text-center mb-6 relative">
            <h1 className="text-5xl font-bold font-mono text-white mb-2 tracking-tighter">SURVIVAL<br/><span className="text-red-600">PROTOCOL: 24</span></h1>
            <p className="text-gray-400 font-mono text-sm">MULTIPLAYER STRATEGY SIMULATION</p>
            
            <div className="absolute top-0 right-0 flex gap-2">
                <button 
                    onClick={() => setShowUpdates(true)}
                    className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors flex flex-col items-center gap-1 group"
                >
                    <FileText size={20} />
                    <span className="text-[9px] font-mono tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">LOGS</span>
                </button>
                {user && (
                  <button 
                      onClick={() => setShowProfile(true)}
                      className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors flex flex-col items-center gap-1 group"
                  >
                      <User size={20} />
                      <span className="text-[9px] font-mono tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">PROFILE</span>
                  </button>
                )}
                {user && (
                   <button 
                      onClick={handleLogout}
                      className="p-2 text-red-500 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors flex flex-col items-center gap-1 group"
                  >
                      <LogOut size={20} />
                      <span className="text-[9px] font-mono tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">EXIT</span>
                  </button>
                )}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
             {!user ? (
                 <AuthForms onLoginSuccess={handleLoginSuccess} />
             ) : (
                <>
                  <div className="text-center mb-8">
                     <p className="text-xs font-mono text-gray-500 mb-1">OPERATIVE ACTIVE</p>
                     <div className="text-2xl text-yellow-500 font-bold tracking-widest uppercase">{user.name}</div>
                  </div>

                  {mode === 'MENU' && (
                    <div className="space-y-3">
                        <button 
                          onClick={() => handleStart()}
                          className="w-full py-4 rounded font-bold text-xl tracking-widest transition-all flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/50"
                        >
                          <Play size={20} />
                          <span>QUICK PLAY</span>
                        </button>
                        
                        <div className="flex gap-3">
                          <button 
                            onClick={() => setMode('CREATE')}
                            className="flex-1 py-3 rounded font-bold text-sm tracking-widest border border-gray-600 hover:bg-gray-800 text-gray-300 transition-all flex items-center justify-center space-x-2"
                          >
                            <Users size={16} />
                            <span>CREATE ROOM</span>
                          </button>
                          <button 
                            onClick={() => setMode('JOIN')}
                            className="flex-1 py-3 rounded font-bold text-sm tracking-widest border border-gray-600 hover:bg-gray-800 text-gray-300 transition-all flex items-center justify-center space-x-2"
                          >
                            <Lock size={16} />
                            <span>JOIN ROOM</span>
                          </button>
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
                </>
             )}
          </div>
        </div>

        {/* Right Side: Tips Chat OR Lobby List */}
        {mode === 'CREATE' ? (
          <div className="w-80 bg-gray-900/90 border border-gray-800 p-4 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col h-[600px]">
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
                  </div>
                ))}
             </div>
          </div>
        ) : (
          <div className="w-80 flex flex-col h-[600px] gap-4">
             {/* Replaces the static Victory Conditions with Live Tips Chat */}
             <TipsChat />
             
             {/* Small static info below if space allows, or just replace fully */}
             <div className="flex-1 bg-black/40 border border-gray-800 rounded-lg p-4 backdrop-blur-md">
                 <h3 className="text-gray-500 font-mono text-xs uppercase mb-2">Survival Notes</h3>
                 <p className="text-[10px] text-gray-600 font-mono leading-relaxed">
                    Account data is stored locally. Clearing cache will wipe progress.<br/><br/>
                    Game is in Beta v2.3.0.
                 </p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { Play, Users, Lock, User, Trophy, FileText, LogOut, Loader, AlertCircle, ArrowLeft, Plus, RefreshCw, Zap, Info, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGameRoom } from '../hooks/useGameRoom';
import { AccountModal } from './AccountModal';
import { AuthForms } from './AuthForms';
import { TipsChat } from './TipsChat';
import { UpdateLogModal } from './UpdateLogModal';
import { CreditModal } from './CreditModal';
import { HowToPlayModal } from './HowToPlayModal';
import { storageService } from '../services/storageService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { RoomDocument, Phase } from '../types';

interface LobbyProps {
  onStart: (name: string, roomCode?: string, isHost?: boolean, roster?: string[], day?: number, phase?: Phase, isPractice?: boolean) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ onStart }) => {
  const { user, userData, logout } = useAuth();
  const { 
      createRoom, 
      joinRoom, 
      loading, 
      error, 
      roomId, 
      roomData, 
      players, 
      startGame,
      attemptReconnect,
      leaveRoom 
  } = useGameRoom();

  const [mode, setMode] = useState<'MENU' | 'BROWSER' | 'CREATE' | 'JOIN_PRIVATE'>('MENU');
  const [inputCode, setInputCode] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  
  // Browser State
  const [browserRooms, setBrowserRooms] = useState<(RoomDocument & { id: string })[]>([]);
  const [browserLoading, setBrowserLoading] = useState(false);

  // Load profile data
  useEffect(() => {
     if (user) {
         storageService.getProfileData().then(setProfileData);
     }
  }, [user]);

  // Attempt Reconnect
  useEffect(() => {
      if (userData?.active_session_id && !roomId) {
          attemptReconnect();
      }
  }, [userData]);

  // Monitor Room State to Trigger Game Start
  useEffect(() => {
      if (roomId && roomData && userData) {
          if (roomData.status === 'IN_PROGRESS') {
             const rosterNames = players.map(p => p.username || 'Unknown');
             const isHost = roomData.host_username === userData.username;
             onStart(
                 userData.username, 
                 roomId, 
                 isHost, 
                 rosterNames, 
                 roomData.current_day, 
                 roomData.phase as Phase,
                 false // Not Practice
             );
          }
      }
  }, [roomId, roomData, players, userData]);

  // Manual Fetch for Browser (Saves Quota vs onSnapshot)
  const refreshBrowser = async () => {
      if (mode !== 'BROWSER') return;
      setBrowserLoading(true);
      try {
          const q = query(
            collection(db, 'rooms'),
            where('is_public', '==', true),
            where('status', '==', 'LOBBY')
          );
          const snap = await getDocs(q);
          const rooms: any[] = [];
          snap.forEach(d => rooms.push({ id: d.id, ...d.data() }));
          setBrowserRooms(rooms);
      } catch (err) {
          console.error("Browser error", err);
      } finally {
          setBrowserLoading(false);
      }
  };

  useEffect(() => {
    if (mode === 'BROWSER') {
        refreshBrowser();
    }
  }, [mode]);

  // If we have a roomId and roomData, we are IN A ROOM (Lobby).
  // This takes precedence over 'mode'.
  const inLobby = roomId && roomData?.status === 'LOBBY';

  const handlePlayClick = () => {
    setMode('BROWSER');
  };

  const handlePracticeClick = () => {
    if (userData?.username) {
        // Start Practice Mode immediately
        onStart(userData.username, 'PRACTICE', true, [], 1, Phase.DAY, true);
    }
  };

  const handleBackToMenu = () => {
    setMode('MENU');
  };

  const handleBackToBrowser = () => {
    setMode('BROWSER');
  };

  const handleCreateRoom = (isPublic: boolean) => {
    createRoom(isPublic);
    // UI will switch to 'inLobby' view automatically when roomId is set
  };
  
  const handleLeaveRoom = () => {
    leaveRoom();
    // After leaving, roomId becomes null. We should default to MENU to be safe.
    setMode('MENU');
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-y-auto overflow-x-hidden">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1598556776374-3382fab3e390?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 fixed"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent fixed"></div>

      <AccountModal 
        isOpen={showProfile} 
        onClose={() => setShowProfile(false)} 
        onNameUpdate={() => {}} 
      />

      <UpdateLogModal 
        isOpen={showUpdates}
        onClose={() => setShowUpdates(false)}
      />

      <CreditModal 
        isOpen={showCredits}
        onClose={() => setShowCredits(false)}
      />

      <HowToPlayModal 
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />

      <div className="relative z-10 max-w-7xl w-full flex flex-col lg:flex-row gap-6 items-start lg:items-stretch">
        {/* Left Side: Leaderboard - Hidden on mobile/tablet, shown on XL */}
        <div className="w-80 hidden xl:flex flex-col gap-4 h-[600px] shrink-0">
             <div className="bg-gray-900/90 border border-gray-800 p-4 rounded-2xl shadow-2xl backdrop-blur-md flex-1 flex flex-col">
                 <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                    <div className="flex items-center gap-2">
                        <Trophy size={14} className="text-yellow-500" />
                        <h3 className="text-gray-400 font-mono text-xs uppercase tracking-widest">LEADERBOARD</h3>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 </div>
                 <div className="flex-1 flex items-center justify-center text-gray-600 font-mono text-xs">
                    ENCRYPTED
                 </div>
             </div>
        </div>

        {/* Center: Controls */}
        <div className="flex-1 w-full bg-gray-900/90 border border-gray-800 p-4 md:p-8 rounded-2xl shadow-2xl backdrop-blur-md h-fit min-h-[400px] md:min-h-[500px] flex flex-col relative">
          {/* Header */}
          <div className="text-center mb-4 relative">
            <h1 className="text-3xl md:text-6xl font-bold font-mono text-white mb-1 tracking-tighter leading-none">
              SURVIVAL<br/><span className="text-red-600">PROTOCOL: 24</span>
            </h1>
            <p className="text-gray-400 font-mono text-[10px] md:text-sm tracking-wide mt-1 md:mt-2">MULTIPLAYER STRATEGY SIMULATION</p>
            
            <div className="absolute top-0 left-0 flex gap-1">
                <button 
                    onClick={() => setShowUpdates(true)}
                    className="p-1 md:p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors flex flex-col items-center gap-1 group"
                    title="Patch Notes"
                >
                    <FileText size={16} className="md:w-5 md:h-5" />
                </button>
                <button 
                    onClick={() => setShowCredits(true)}
                    className="p-1 md:p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors flex flex-col items-center gap-1 group"
                    title="Credits"
                >
                    <Info size={16} className="md:w-5 md:h-5" />
                </button>
            </div>

            <div className="absolute top-0 right-0 flex gap-2">
                {user && (
                  <button 
                      onClick={() => setShowProfile(true)}
                      className="p-1 md:p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors flex flex-col items-center gap-1 group"
                      title="Profile"
                  >
                      <User size={16} className="md:w-5 md:h-5" />
                  </button>
                )}
                {user && (
                   <button 
                      onClick={logout}
                      className="p-1 md:p-2 text-red-500 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors flex flex-col items-center gap-1 group"
                      title="Logout"
                  >
                      <LogOut size={16} className="md:w-5 md:h-5" />
                  </button>
                )}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center relative">
             {error && (
                 <div className="absolute top-0 w-full bg-red-900/50 border border-red-500 text-red-200 text-xs p-2 text-center rounded mb-4 flex items-center justify-center gap-2">
                     <AlertCircle size={14} /> {error}
                 </div>
             )}
             
             {loading && (
                 <div className="absolute inset-0 bg-gray-900/80 z-50 flex items-center justify-center">
                     <Loader className="animate-spin text-yellow-500" size={32} />
                 </div>
             )}

             {!user ? (
                 <AuthForms onLoginSuccess={() => {}} />
             ) : (
                <>
                  <div className="text-center mb-6">
                     <p className="text-[9px] md:text-[10px] font-mono text-gray-500 mb-0.5 tracking-widest">OPERATIVE ACTIVE</p>
                     <div className="text-2xl md:text-3xl text-yellow-500 font-bold tracking-widest uppercase">{userData?.username}</div>
                  </div>

                  {inLobby ? (
                    // ==============================
                    // 4. ROOM LOBBY (ACTIVE ROOM)
                    // ==============================
                    <div className="space-y-4 md:space-y-6 animate-fade-in">
                      <div className="text-center border border-gray-700 bg-black/50 p-4 md:p-6 rounded-lg relative">
                        <div className="absolute top-2 right-2 flex gap-1">
                           <div className="text-[9px] md:text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400 font-mono">
                               {roomData?.is_public ? 'PUBLIC' : 'PRIVATE'}
                           </div>
                        </div>
                        <p className="text-gray-500 text-xs font-mono mb-2">ACCESS CODE</p>
                        <div className="text-4xl md:text-5xl font-mono text-yellow-500 tracking-[0.2em] font-bold mb-4">{roomId}</div>
                        <div className="text-gray-300 font-bold mb-2 uppercase tracking-wide text-sm md:text-base">{roomData?.room_name || "LOBBY"}</div>
                        <div className="flex items-center justify-center space-x-2 text-gray-400">
                           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                           <span className="text-xs font-mono">PLAYERS: {players.length}/24</span>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button 
                          onClick={handleLeaveRoom}
                          className="flex-1 py-3 rounded font-bold text-xs md:text-sm tracking-widest border border-gray-600 hover:bg-gray-800 text-gray-400 transition-colors"
                        >
                          LEAVE ROOM
                        </button>
                        {roomData?.host_username === userData?.username ? (
                            <button 
                              onClick={() => startGame()}
                              className="flex-[2] py-3 rounded font-bold text-xs md:text-sm tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/50 transition-colors"
                            >
                              START MATCH
                            </button>
                        ) : (
                            <div className="flex-[2] flex items-center justify-center text-[10px] md:text-xs font-mono text-gray-500 animate-pulse border border-gray-800 rounded bg-black/20">
                                WAITING FOR HOST...
                            </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // ==============================
                    // MAIN NAVIGATION
                    // ==============================
                    <>
                      {/* 1. MAIN MENU */}
                      {mode === 'MENU' && (
                        <div className="space-y-3 md:space-y-4 animate-fade-in">
                            <button 
                              onClick={handlePlayClick}
                              className="w-full py-4 md:py-6 rounded-lg font-bold text-xl md:text-2xl tracking-[0.2em] transition-all flex items-center justify-center space-x-3 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/50 group"
                            >
                              <Play size={20} className="fill-current group-hover:scale-110 transition-transform md:w-6 md:h-6" />
                              <span>PLAY</span>
                            </button>

                            <button 
                              onClick={handlePracticeClick}
                              className="w-full py-3 md:py-4 rounded-lg font-bold text-base md:text-lg tracking-[0.2em] transition-all flex items-center justify-center space-x-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 text-gray-300 group"
                            >
                              <Zap size={18} className="text-yellow-500 group-hover:scale-110 transition-transform md:w-5 md:h-5" />
                              <span>PRACTICE</span>
                            </button>

                            <button 
                              onClick={() => setShowHowToPlay(true)}
                              className="w-full py-3 rounded-lg font-bold text-xs md:text-sm tracking-[0.2em] transition-all flex items-center justify-center space-x-2 bg-transparent hover:bg-gray-800 border border-gray-800 hover:border-gray-600 text-gray-500 hover:text-gray-300 group"
                            >
                              <BookOpen size={14} className="group-hover:scale-110 transition-transform md:w-4 md:h-4" />
                              <span>HOW TO PLAY</span>
                            </button>
                        </div>
                      )}

                      {/* 2. PUBLIC ROOM LIST SCREEN */}
                      {mode === 'BROWSER' && (
                        <div className="space-y-4 animate-fade-in flex flex-col h-full min-h-[300px]">
                           {/* Browser Header */}
                           <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-2">
                              <h3 className="text-gray-400 font-mono text-xs md:text-sm">PUBLIC FREQUENCIES</h3>
                              <div className="flex gap-2">
                                  <button onClick={() => setMode('CREATE')} className="text-[10px] bg-yellow-900/20 text-yellow-500 px-2 py-1 rounded border border-yellow-800 hover:bg-yellow-900/40 flex items-center gap-1">
                                      <Plus size={10} /> NEW ROOM
                                  </button>
                                  <button onClick={() => setMode('JOIN_PRIVATE')} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded hover:bg-gray-700 flex items-center gap-1">
                                      <Lock size={10} /> CODE
                                  </button>
                              </div>
                           </div>

                           {/* List Area */}
                           <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[200px] max-h-[300px] bg-black/20 rounded p-2 border border-gray-800/50">
                              {browserLoading ? (
                                 <div className="flex justify-center items-center h-full text-gray-600 gap-2">
                                     <Loader size={16} className="animate-spin" /> SCANNING...
                                 </div>
                              ) : browserRooms.length === 0 ? (
                                 <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-3">
                                     <AlertCircle size={24} className="opacity-50" />
                                     <div className="text-center">
                                         <p className="text-xs font-mono mb-2">NO ACTIVE SIGNALS DETECTED</p>
                                         <div className="flex gap-2 justify-center">
                                            <button 
                                                onClick={refreshBrowser}
                                                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded border border-gray-600 font-mono flex items-center gap-1"
                                            >
                                                <RefreshCw size={10} /> REFRESH
                                            </button>
                                            <button 
                                                onClick={() => setMode('CREATE')}
                                                className="px-3 py-1 bg-yellow-900/20 hover:bg-yellow-900/40 text-yellow-500 text-xs rounded border border-yellow-800 font-mono"
                                            >
                                                CREATE
                                            </button>
                                         </div>
                                     </div>
                                 </div>
                              ) : (
                                 <>
                                 <div className="flex justify-end mb-2">
                                    <button onClick={refreshBrowser} className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1">
                                        <RefreshCw size={10} /> REFRESH LIST
                                    </button>
                                 </div>
                                 {browserRooms.map(room => (
                                     <button
                                        key={room.id}
                                        onClick={() => joinRoom(room.id)}
                                        className="w-full bg-gray-900/80 hover:bg-gray-800 border border-gray-700 hover:border-yellow-600 p-3 rounded flex justify-between items-center group transition-all"
                                     >
                                        <div className="text-left">
                                           <div className="text-sm font-bold text-gray-200 group-hover:text-yellow-500 font-mono">
                                               {room.room_name || "Unknown Lobby"}
                                           </div>
                                           <div className="text-[10px] text-gray-500 font-mono">HOST: {room.host_username}</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-xs font-mono text-gray-400 bg-black/50 px-2 py-1 rounded">
                                                {room.player_count}/24
                                            </div>
                                            <Play size={14} className="text-gray-600 group-hover:text-white" />
                                        </div>
                                     </button>
                                 ))}
                                 </>
                              )}
                           </div>

                           {/* Footer Navigation */}
                           <button 
                              onClick={handleBackToMenu}
                              className="w-full py-3 border border-gray-700 hover:bg-gray-800 text-gray-400 text-xs font-mono rounded flex items-center justify-center gap-2 mt-auto"
                           >
                              <ArrowLeft size={14} /> RETURN TO MAIN MENU
                           </button>
                        </div>
                      )}

                      {/* 3. CREATE ROOM FLOW */}
                      {mode === 'CREATE' && (
                         <div className="space-y-4 animate-fade-in">
                            <h3 className="text-center text-gray-400 font-mono text-xs md:text-sm border-b border-gray-800 pb-2">INITIALIZE PROTOCOL</h3>
                            
                            <div className="grid grid-cols-1 gap-3">
                                <button 
                                    onClick={() => handleCreateRoom(true)}
                                    className="p-4 bg-gray-800 hover:bg-yellow-900/20 border border-gray-600 hover:border-yellow-600 text-white rounded flex flex-col items-center gap-2 transition-all group"
                                >
                                    <Users size={24} className="text-gray-400 group-hover:text-yellow-500" />
                                    <span className="font-mono font-bold tracking-widest text-sm">PUBLIC MATCH</span>
                                    <span className="text-[10px] text-gray-500">Listed in browser. Open to all operatives.</span>
                                </button>
                                
                                <button 
                                    onClick={() => handleCreateRoom(false)}
                                    className="p-4 bg-gray-800 hover:bg-blue-900/20 border border-gray-600 hover:border-blue-500 text-white rounded flex flex-col items-center gap-2 transition-all group"
                                >
                                    <Lock size={24} className="text-gray-400 group-hover:text-blue-500" />
                                    <span className="font-mono font-bold tracking-widest text-sm">PRIVATE LOBBY</span>
                                    <span className="text-[10px] text-gray-500">Hidden. Requires access code to join.</span>
                                </button>
                            </div>

                            <button onClick={handleBackToBrowser} className="text-xs text-gray-500 hover:text-white w-full text-center mt-4 flex items-center justify-center gap-1">
                                <ArrowLeft size={12} /> CANCEL
                            </button>
                         </div>
                      )}

                      {/* JOIN PRIVATE FLOW */}
                      {mode === 'JOIN_PRIVATE' && (
                        <div className="space-y-6 animate-fade-in">
                          <div>
                            <label className="block text-xs font-mono text-gray-500 mb-1 text-center">SECURE FREQUENCY CODE</label>
                            <input 
                              type="text" 
                              value={inputCode}
                              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                              placeholder="XXXXX"
                              maxLength={5}
                              className="w-full bg-black/50 border border-gray-700 text-white px-4 py-4 rounded text-2xl font-bold tracking-[0.5em] text-center focus:outline-none focus:border-yellow-500 transition-colors uppercase"
                              autoFocus
                            />
                          </div>

                          <div className="flex gap-3">
                            <button 
                              onClick={handleBackToBrowser}
                              className="flex-1 py-3 rounded font-bold text-sm tracking-widest border border-gray-600 hover:bg-gray-800 text-gray-400"
                            >
                              BACK
                            </button>
                            <button 
                              onClick={() => joinRoom(inputCode)}
                              disabled={inputCode.length < 5}
                              className={`flex-[2] py-3 rounded font-bold text-sm tracking-widest transition-all
                                ${inputCode.length >= 5 ? 'bg-yellow-600 hover:bg-yellow-700 text-black' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
                              `}
                            >
                              CONNECT
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
             )}
          </div>
          
          {/* Discrete Credits at bottom */}
          {!inLobby && user && mode === 'MENU' && (
            <div className="mt-8 text-center">
               <button 
                 onClick={() => setShowCredits(true)}
                 className="text-[10px] font-mono text-gray-600 hover:text-gray-400 transition-colors tracking-widest uppercase"
               >
                 SYSTEM CREDITS
               </button>
            </div>
          )}
        </div>

        {/* Right Side: Roster in Lobby OR Tips - Responsive stacking */}
        {inLobby ? (
          <div className="w-full lg:w-80 bg-gray-900/90 border border-gray-800 p-4 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col h-[300px] lg:h-[600px] shrink-0">
             <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
               <h3 className="text-gray-400 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                  <Users size={14} />
                  Squad ({players.length})
               </h3>
             </div>
             <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {players.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-black/40 p-3 rounded border border-gray-800 text-sm font-mono text-gray-300 animate-fade-in">
                     <div className="flex items-center space-x-3">
                        <User size={14} className={p.username === roomData?.host_username ? "text-yellow-500" : "text-gray-600"} />
                        <span className="truncate max-w-[150px]">{p.username}</span>
                     </div>
                     {p.username === roomData?.host_username && <span className="text-[9px] bg-yellow-900/50 text-yellow-500 px-1 rounded">HOST</span>}
                  </div>
                ))}
             </div>
          </div>
        ) : (
          <div className="w-full lg:w-80 flex flex-col h-[200px] lg:h-[600px] gap-4 shrink-0">
             <TipsChat />
          </div>
        )}
      </div>
    </div>
  );
};

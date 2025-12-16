
import { useState, useEffect } from 'react';
import { 
    doc, setDoc, getDoc, updateDoc, onSnapshot, collection, 
    query, where, getDocs, writeBatch, serverTimestamp, increment, deleteDoc 
} from 'firebase/firestore';
import { ref, onDisconnect, set, remove } from 'firebase/database';
import { db, rtdb } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { RoomDocument, FirestorePlayer, Phase, PlayerStatus } from '../types';
import { GAME_CONFIG, NAMES_LIST } from '../constants';

export const useGameRoom = () => {
  const { user, userData } = useAuth();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<RoomDocument | null>(null);
  const [players, setPlayers] = useState<FirestorePlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- ROOM LISTENERS ---
  useEffect(() => {
    if (!roomId) {
        setRoomData(null);
        setPlayers([]);
        return;
    }

    // Listen to Room Doc
    const roomUnsub = onSnapshot(doc(db, 'rooms', roomId), (docSnap) => {
       if (docSnap.exists()) {
           setRoomData(docSnap.data() as RoomDocument);
       } else {
           // Room deleted or doesn't exist -> Kick user to menu
           setRoomId(null);
           setRoomData(null);
           setPlayers([]);
           // Ensure session is cleared if we get kicked
           if (userData?.username) {
              setDoc(doc(db, 'users', userData.username), { active_session_id: null }, { merge: true });
           }
       }
    }, (err) => {
        console.error("Room listener error", err);
        if (err.code === 'permission-denied') {
            setError("Database access denied. Check Firestore Rules in Firebase Console.");
        }
    });

    // Listen to Players
    const playersRef = collection(db, 'rooms', roomId, 'players');
    const playersUnsub = onSnapshot(playersRef, (snapshot) => {
        const pList: FirestorePlayer[] = [];
        snapshot.forEach((doc) => {
            pList.push({ ...doc.data() as FirestorePlayer, username: doc.id });
        });
        setPlayers(pList);
    }, (err) => {
        console.error("Player listener error", err);
    });

    return () => {
        roomUnsub();
        playersUnsub();
    };
  }, [roomId, userData]); // Added userData dependency for session clear

  // --- PRESENCE SYSTEM ---
  useEffect(() => {
    if (!roomId || !userData?.username) return;

    const username = userData.username;
    const presenceRef = ref(rtdb, `rooms/${roomId}/players/${username}`);
    const firestorePlayerRef = doc(db, 'rooms', roomId, 'players', username);

    // Set RTDB presence to online
    set(presenceRef, { status: 'online', last_changed: Date.now() });

    // On Disconnect: remove RTDB node
    onDisconnect(presenceRef).remove();

    // Heartbeat logic could go here, but for now we rely on explicit actions
    // Mark as CONNECTED in Firestore on mount
    updateDoc(firestorePlayerRef, { 
        connection_status: 'CONNECTED',
        last_active: Date.now()
    }).catch(console.error);

    return () => {
        // We do NOT mark disconnected here to handle page refreshes gracefully
        // The RTDB onDisconnect handles the actual "tab closed" scenario detection for other clients
    };
  }, [roomId, userData]);

  // --- HOST RECONCILIATION (SINGLE SOURCE OF TRUTH) ---
  useEffect(() => {
    if (!roomId || !roomData || !userData) return;
    
    // Only Host performs reconciliation to avoid write contention
    if (roomData.host_username !== userData.username) return;
    
    // Only strictly needed in Lobby for public listing accuracy
    // Once game starts, bots are added and count is managed differently
    if (roomData.status !== 'LOBBY') return;

    const realCount = players.length;
    
    // If mismatch detected, correct it
    // This self-heals any failed 'increment' operations from leaving players
    if (roomData.player_count !== realCount) {
        console.log(`Reconciling player count: ${roomData.player_count} -> ${realCount}`);
        updateDoc(doc(db, 'rooms', roomId), {
            player_count: realCount
        }).catch(console.error);
    }
  }, [players.length, roomData?.player_count, roomId, roomData?.host_username, userData?.username, roomData?.status]);

  // --- ACTIONS ---

  const handleFirebaseError = (err: any) => {
      console.error(err);
      if (err.code === 'permission-denied') {
          setError("Access Denied: Please set Firestore Security Rules to public (test mode) in Firebase Console.");
      } else {
          setError(err.message || "An unexpected error occurred.");
      }
  };

  const getInitialPlayerState = (): FirestorePlayer => ({
    is_bot: false,
    connection_status: 'CONNECTED',
    last_active: Date.now(),
    hp: GAME_CONFIG.START_HP,
    hunger: GAME_CONFIG.START_HUNGER,
    fatigue: GAME_CONFIG.START_FATIGUE,
    inventory: [],
    pending_action: { type: 'NONE', target: null },
    status: PlayerStatus.ALIVE,
    cooldowns: { eat: 0, rest: 0, run: 0, shoot: 0, eatCount: 0, restCount: 0 },
    active_buffs: { damageBonus: 0, ignoreFatigue: false },
    last_explore_day: 0,
    kills: 0,
    has_pistol: false,
    avatar_id: Math.floor(Math.random() * 1000) + 1
  });

  const createRoom = async (isPublic: boolean) => {
    if (!userData) {
        setError("User data not loaded. Please wait or re-login.");
        return;
    }
    setLoading(true);
    setError(null);
    try {
        const code = Math.random().toString(36).substring(2, 7).toUpperCase();
        
        const newRoom: RoomDocument = {
            room_name: `${userData.username}'s Lobby`,
            host_username: userData.username,
            is_public: isPublic,
            player_count: 1,
            status: 'LOBBY',
            current_day: 1,
            phase: Phase.DAY,
            next_phase_time: null,
            events: []
        };

        const hostPlayer = getInitialPlayerState();

        const batch = writeBatch(db);
        batch.set(doc(db, 'rooms', code), newRoom);
        batch.set(doc(db, 'rooms', code, 'players', userData.username), hostPlayer);
        
        // Use set with merge: true for robustness
        batch.set(doc(db, 'users', userData.username), { active_session_id: code }, { merge: true });

        await batch.commit();
        setRoomId(code);
    } catch (err: any) {
        handleFirebaseError(err);
    } finally {
        setLoading(false);
    }
  };

  const joinRoom = async (code: string) => {
     if (!userData) {
         setError("User data not loaded.");
         return;
     }
     setLoading(true);
     setError(null);
     try {
         const roomRef = doc(db, 'rooms', code);
         const roomSnap = await getDoc(roomRef);
         
         if (!roomSnap.exists()) throw new Error("Room not found");
         const rData = roomSnap.data() as RoomDocument;
         
         if (rData.status !== 'LOBBY') throw new Error("Match already in progress");

         // Check if already in (rejoin logic handles this usually, but explicit join needs check)
         const playerRef = doc(db, 'rooms', code, 'players', userData.username);
         const playerSnap = await getDoc(playerRef);

         const batch = writeBatch(db);
         
         if (!playerSnap.exists()) {
             // New Join
            const newPlayer = getInitialPlayerState();
            batch.set(playerRef, newPlayer);
            batch.update(roomRef, { player_count: increment(1) });
         } else {
             // Re-join existing
             batch.update(playerRef, { connection_status: 'CONNECTED', last_active: Date.now() });
         }
         
         // Use set with merge: true
         batch.set(doc(db, 'users', userData.username), { active_session_id: code }, { merge: true });
         
         await batch.commit();

         setRoomId(code);
     } catch (err: any) {
         handleFirebaseError(err);
     } finally {
         setLoading(false);
     }
  };

  const startGame = async () => {
      if (!roomId || !roomData) return;
      // Only host can start
      if (roomData.host_username !== userData?.username) return;

      setLoading(true);
      try {
         const batch = writeBatch(db);
         const currentCount = players.length;
         const botsNeeded = GAME_CONFIG.MAX_PLAYERS - currentCount;
         
         // Helper to get unique random name
         const usedNames = new Set(players.map(p => p.username));
         const availableNames = NAMES_LIST.filter(n => !usedNames.has(n));
         
         for(let i=0; i < botsNeeded; i++) {
             // Fallback to bot-i if we run out of names
             let botName = `Bot-${i+1}`;
             if (availableNames.length > 0) {
                 const rIdx = Math.floor(Math.random() * availableNames.length);
                 botName = availableNames[rIdx];
                 availableNames.splice(rIdx, 1);
             }

             const botRef = doc(db, 'rooms', roomId, 'players', botName);
             const botData: FirestorePlayer = {
                ...getInitialPlayerState(),
                is_bot: true,
                avatar_id: Math.floor(Math.random() * 1000) + 1
             };
             batch.set(botRef, botData);
         }

         batch.update(doc(db, 'rooms', roomId), { 
             status: 'IN_PROGRESS',
             player_count: 24, // Filled
             next_phase_time: serverTimestamp() 
         });

         await batch.commit();
      } catch (err: any) {
          handleFirebaseError(err);
      } finally {
          setLoading(false);
      }
  };

  const leaveRoom = async () => {
      if (!roomId || !userData) return;
      
      const targetRoomId = roomId;
      const isHost = roomData?.host_username === userData.username;
      const isLobby = roomData?.status === 'LOBBY';

      try {
          // 1. Clear session immediately so UI updates and Reconnect doesn't fire
          await setDoc(doc(db, 'users', userData.username), { active_session_id: null }, { merge: true });
          
          if (targetRoomId && isLobby) {
              if (isHost) {
                  // HOST LEAVING LOBBY -> DESTROY ROOM
                  await deleteDoc(doc(db, 'rooms', targetRoomId));
              } else {
                  // GUEST LEAVING LOBBY -> REMOVE PLAYER
                  const batch = writeBatch(db);
                  batch.delete(doc(db, 'rooms', targetRoomId, 'players', userData.username));
                  batch.update(doc(db, 'rooms', targetRoomId), {
                      player_count: increment(-1)
                  });
                  await batch.commit();
              }
          }

          setRoomId(null);
          setRoomData(null);
          setPlayers([]);
      } catch (e) {
          console.error("Error leaving room:", e);
      }
  };

  const attemptReconnect = async () => {
      if (!userData?.active_session_id) return false;
      const code = userData.active_session_id;
      
      try {
          const roomSnap = await getDoc(doc(db, 'rooms', code));
          if (roomSnap.exists()) {
              setRoomId(code);
              // Mark connected
              await updateDoc(doc(db, 'rooms', code, 'players', userData.username), { 
                  connection_status: 'CONNECTED',
                  last_active: Date.now()
              });
              return true;
          } else {
              // Clean up dead session
              await setDoc(doc(db, 'users', userData.username), { active_session_id: null }, { merge: true });
              return false;
          }
      } catch (e) {
          console.error("Reconnect failed", e);
          return false;
      }
  };

  return {
    roomId,
    roomData,
    players,
    loading,
    error,
    createRoom,
    joinRoom,
    startGame,
    leaveRoom,
    attemptReconnect
  };
};


import { useState, useEffect } from 'react';
import { 
    doc, setDoc, getDoc, updateDoc, onSnapshot, collection, 
    writeBatch, serverTimestamp, increment, getDocs, deleteDoc 
} from 'firebase/firestore';
import { ref, onDisconnect, set } from 'firebase/database';
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

    const currentUsername = userData?.username;

    // Listen to Room Doc
    const roomUnsub = onSnapshot(doc(db, 'rooms', roomId), (docSnap) => {
       if (docSnap.exists()) {
           setRoomData(docSnap.data() as RoomDocument);
       } else {
           console.log("Room deleted or invalid, resetting state.");
           setRoomId(null);
           setRoomData(null);
           setPlayers([]);
           if (currentUsername) {
              setDoc(doc(db, 'users', currentUsername), { active_session_id: null }, { merge: true });
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
  }, [roomId, userData?.username]); 

  // --- PRESENCE SYSTEM ---
  useEffect(() => {
    if (!roomId || !userData?.username) return;

    const username = userData.username;
    const presenceRef = ref(rtdb, `rooms/${roomId}/players/${username}`);
    const firestorePlayerRef = doc(db, 'rooms', roomId, 'players', username);

    set(presenceRef, { status: 'online', last_changed: Date.now() });
    onDisconnect(presenceRef).remove();

    updateDoc(firestorePlayerRef, { 
        connection_status: 'CONNECTED',
        last_active: Date.now()
    }).catch(console.error);
  }, [roomId, userData?.username]);

  const destroyRoom = async (targetRoomId: string) => {
      try {
          console.log(`Destroying room ${targetRoomId}...`);
          
          // 1. Delete all players in subcollection
          const playersRef = collection(db, 'rooms', targetRoomId, 'players');
          const playerSnaps = await getDocs(playersRef);
          
          const batch = writeBatch(db);
          playerSnaps.forEach((doc) => {
              batch.delete(doc.ref);
          });
          
          // 2. Delete the room document
          batch.delete(doc(db, 'rooms', targetRoomId));
          
          await batch.commit();
          console.log("Room destroyed successfully.");
      } catch (e) {
          console.error("Failed to destroy room", e);
      }
  };

  const handleFirebaseError = (err: any) => {
      console.error(err);
      if (err.code === 'permission-denied') {
          setError("Access Denied: Please set Firestore Security Rules to public (test mode) in Firebase Console.");
      } else if (err.message === "Request timed out") {
          setError("Network Timeout: Unable to create room. Please try again.");
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
    status: 'ALIVE' as PlayerStatus, // Cast string literal to Type for TS satisfaction, avoids Enum runtime access
    cooldowns: { eat: 0, rest: 0, run: 0, shoot: 0, eatCount: 0, restCount: 0 },
    active_buffs: { damageBonus: 0, ignoreFatigue: false },
    last_explore_day: 0,
    kills: 0,
    has_pistol: false,
    avatar_id: Math.floor(Math.random() * 1000) + 1
  });

  const createRoom = async (isPublic: boolean) => {
    if (!userData?.username) {
        setError("User data not loaded. Please wait or re-login.");
        return;
    }
    setLoading(true);
    setError(null);
    try {
        const code = Math.random().toString(36).substring(2, 7).toUpperCase();
        
        // SAFE SCHEMA: Use string literals instead of Enums to prevent runtime resolution failures
        const newRoom = {
            room_name: `${userData.username}'s Lobby`,
            host_username: userData.username,
            is_public: isPublic,
            player_count: 1,
            status: 'LOBBY',
            current_day: 1,
            phase: 'DAY', // Hardcoded 'DAY'
            next_phase_time: null,
            events: []
        };

        const hostPlayer = getInitialPlayerState();
        // Force status string to ensure it's valid
        hostPlayer.status = 'ALIVE' as PlayerStatus; 

        const batch = writeBatch(db);
        batch.set(doc(db, 'rooms', code), newRoom);
        batch.set(doc(db, 'rooms', code, 'players', userData.username), hostPlayer);
        batch.set(doc(db, 'users', userData.username), { active_session_id: code }, { merge: true });

        // TIMEOUT WRAPPER for safety
        const commitPromise = batch.commit();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Request timed out")), 15000)
        );

        await Promise.race([commitPromise, timeoutPromise]);
        
        setRoomId(code);
    } catch (err: any) {
        handleFirebaseError(err);
    } finally {
        setLoading(false);
    }
  };

  const joinRoom = async (code: string) => {
     if (!userData?.username) {
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

         const playerRef = doc(db, 'rooms', code, 'players', userData.username);
         const playerSnap = await getDoc(playerRef);

         const batch = writeBatch(db);
         
         if (!playerSnap.exists()) {
            const newPlayer = getInitialPlayerState();
            batch.set(playerRef, newPlayer);
            batch.update(roomRef, { player_count: increment(1) });
         } else {
             batch.update(playerRef, { connection_status: 'CONNECTED', last_active: Date.now() });
         }
         
         batch.set(doc(db, 'users', userData.username), { active_session_id: code }, { merge: true });
         
         const commitPromise = batch.commit();
         const timeoutPromise = new Promise((_, reject) => 
             setTimeout(() => reject(new Error("Request timed out")), 15000)
         );

         await Promise.race([commitPromise, timeoutPromise]);

         setRoomId(code);
     } catch (err: any) {
         handleFirebaseError(err);
     } finally {
         setLoading(false);
     }
  };

  const startGame = async () => {
      if (!roomId || !roomData) return;
      if (roomData.host_username !== userData?.username) return;

      setLoading(true);
      try {
         const batch = writeBatch(db);
         const currentCount = players.length;
         const botsNeeded = GAME_CONFIG.MAX_PLAYERS - currentCount;
         
         const usedNames = new Set(players.map(p => p.username));
         const availableNames = NAMES_LIST.filter(n => !usedNames.has(n));
         
         for(let i=0; i < botsNeeded; i++) {
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
             player_count: 24, 
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
      if (!roomId || !userData?.username) return;
      
      const targetRoomId = roomId;
      const isHost = roomData?.host_username === userData.username;
      const isLobby = roomData?.status === 'LOBBY';

      try {
          await setDoc(doc(db, 'users', userData.username), { active_session_id: null }, { merge: true });
          
          if (isLobby) {
              if (isHost) {
                  // HOST LEAVE LOBBY -> DESTROY ROOM
                  await destroyRoom(targetRoomId); 
              } else {
                  // CLIENT LEAVE LOBBY -> REMOVE PLAYER & DECREMENT COUNT
                  const batch = writeBatch(db);
                  batch.delete(doc(db, 'rooms', targetRoomId, 'players', userData.username));
                  batch.update(doc(db, 'rooms', targetRoomId), {
                      player_count: increment(-1)
                  });
                  await batch.commit();
              }
          } else {
              // IN-GAME LEAVE (Manual Exit) -> Mark Disconnected & Decrement Count
              // Logic matches "On player leave... player_count = player_count - 1"
              const batch = writeBatch(db);
              batch.update(doc(db, 'rooms', targetRoomId, 'players', userData.username), {
                  connection_status: 'DISCONNECTED'
              });
              batch.update(doc(db, 'rooms', targetRoomId), {
                  player_count: increment(-1)
              });
              await batch.commit();
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
              await updateDoc(doc(db, 'rooms', code, 'players', userData.username), { 
                  connection_status: 'CONNECTED',
                  last_active: Date.now()
              });
              return true;
          } else {
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
    attemptReconnect,
    destroyRoom 
  };
};

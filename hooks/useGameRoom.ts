
import { useState, useEffect } from 'react';
import { doc, setDoc, getDoc, updateDoc, onSnapshot, collection, addDoc, query, where, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { ref, onDisconnect, set, remove } from 'firebase/database'; // Realtime DB for presence
import { db, rtdb } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { RoomDocument, FirestorePlayer, Phase } from '../types';
import { GAME_CONFIG } from '../constants';

export const useGameRoom = () => {
  const { user, userData } = useAuth();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<RoomDocument | null>(null);
  const [players, setPlayers] = useState<FirestorePlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- ROOM LISTENERS ---
  useEffect(() => {
    if (!roomId) return;

    // Listen to Room Doc
    const roomUnsub = onSnapshot(doc(db, 'rooms', roomId), (doc) => {
       if (doc.exists()) {
           setRoomData(doc.data() as RoomDocument);
       } else {
           // Room deleted (Match ended)
           setRoomId(null);
           setRoomData(null);
       }
    });

    // Listen to Players Subcollection
    const playersUnsub = onSnapshot(collection(db, 'rooms', roomId, 'players'), (snapshot) => {
        const pList: FirestorePlayer[] = [];
        snapshot.forEach((doc) => {
            pList.push({ ...doc.data() as FirestorePlayer, username: doc.id });
        });
        setPlayers(pList);
    });

    return () => {
        roomUnsub();
        playersUnsub();
    };
  }, [roomId]);

  // --- PRESENCE SYSTEM (DISCONNECT) ---
  useEffect(() => {
    if (!roomId || !userData?.username) return;

    const username = userData.username;
    // Realtime Database Ref for Presence
    const presenceRef = ref(rtdb, `rooms/${roomId}/players/${username}`);

    // Firestore Ref for Status
    const firestorePlayerRef = doc(db, 'rooms', roomId, 'players', username);

    // On Disconnect (Tab Close), remove from RTDB (trigger only)
    onDisconnect(presenceRef).set('offline').then(() => {
         set(presenceRef, 'online');
         // Also update Firestore status strictly on connect
         updateDoc(firestorePlayerRef, { connection_status: 'CONNECTED' });
    });

    // Note: A true "On Disconnect update Firestore" requires Cloud Functions triggered by RTDB onDisconnect
    // For this prototype, we update to 'CONNECTED' on mount.
    // Ideally, we'd use a Cloud Function to listen to RTDB delete/update events and update Firestore.

    return () => {
        // Cleanup if needed manually
    };
  }, [roomId, userData]);


  // --- ACTIONS ---

  const createRoom = async (isPublic: boolean) => {
    if (!userData) return;
    setLoading(true);
    try {
        // Generate 5-char code
        const code = Math.random().toString(36).substring(2, 7).toUpperCase();
        
        const newRoom: RoomDocument = {
            host_username: userData.username,
            is_public: isPublic,
            status: 'LOBBY',
            current_day: 1,
            phase: Phase.DAY,
            next_phase_time: null, // Logic will handle this
            events: []
        };

        // Create Room
        await setDoc(doc(db, 'rooms', code), newRoom);
        
        // Add Host as Player
        const hostPlayer: FirestorePlayer = {
            is_bot: false,
            connection_status: 'CONNECTED',
            hp: GAME_CONFIG.START_HP,
            hunger: GAME_CONFIG.START_HUNGER,
            fatigue: GAME_CONFIG.START_FATIGUE,
            inventory: [],
            pending_action: { type: 'NONE', target: null }
        };
        await setDoc(doc(db, 'rooms', code, 'players', userData.username), hostPlayer);
        
        // Update User Active Session
        await updateDoc(doc(db, 'users', userData.username), { active_session_id: code });

        setRoomId(code);
    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const joinRoom = async (code: string) => {
     if (!userData) return;
     setLoading(true);
     try {
         const roomRef = doc(db, 'rooms', code);
         const roomSnap = await getDoc(roomRef);
         
         if (!roomSnap.exists()) throw new Error("Room not found");
         const rData = roomSnap.data() as RoomDocument;
         
         if (rData.status !== 'LOBBY') throw new Error("Match already in progress");

         // Add Player
         const newPlayer: FirestorePlayer = {
            is_bot: false,
            connection_status: 'CONNECTED',
            hp: GAME_CONFIG.START_HP,
            hunger: GAME_CONFIG.START_HUNGER,
            fatigue: GAME_CONFIG.START_FATIGUE,
            inventory: [],
            pending_action: { type: 'NONE', target: null }
        };
        await setDoc(doc(db, 'rooms', code, 'players', userData.username), newPlayer);
        
        // Update Session
        await updateDoc(doc(db, 'users', userData.username), { active_session_id: code });

        setRoomId(code);
     } catch (err: any) {
         setError(err.message);
     } finally {
         setLoading(false);
     }
  };

  const startGame = async () => {
      if (!roomId || !roomData) return;
      setLoading(true);
      try {
         const batch = writeBatch(db);
         
         // Fill Bots
         const currentCount = players.length;
         const botsNeeded = GAME_CONFIG.MAX_PLAYERS - currentCount;
         
         for(let i=0; i < botsNeeded; i++) {
             const botId = `bot-${i}`;
             const botRef = doc(db, 'rooms', roomId, 'players', botId);
             const botData: FirestorePlayer = {
                is_bot: true,
                connection_status: 'CONNECTED',
                hp: GAME_CONFIG.START_HP,
                hunger: GAME_CONFIG.START_HUNGER,
                fatigue: GAME_CONFIG.START_FATIGUE,
                inventory: [],
                pending_action: { type: 'NONE', target: null }
             };
             batch.set(botRef, botData);
         }

         // Update Room Status
         const roomRef = doc(db, 'rooms', roomId);
         batch.update(roomRef, { 
             status: 'IN_PROGRESS',
             next_phase_time: serverTimestamp() // Logic should calculate actual time + offset
         });

         await batch.commit();
      } catch (err: any) {
          setError(err.message);
      } finally {
          setLoading(false);
      }
  };

  const leaveRoom = async () => {
      if (!roomId || !userData) return;
      // If lobby -> remove player. If game -> mark disconnected/dead?
      // For now, simple clear session
      await updateDoc(doc(db, 'users', userData.username), { active_session_id: null });
      setRoomId(null);
      setRoomData(null);
  };

  const attemptReconnect = async () => {
      if (!userData?.active_session_id) return false;
      
      const code = userData.active_session_id;
      const roomSnap = await getDoc(doc(db, 'rooms', code));
      
      if (roomSnap.exists()) {
          setRoomId(code);
          // Restore Connection Status
          await updateDoc(doc(db, 'rooms', code, 'players', userData.username), { connection_status: 'CONNECTED' });
          return true;
      } else {
          // Room ended, clear session
          await updateDoc(doc(db, 'users', userData.username), { active_session_id: null });
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

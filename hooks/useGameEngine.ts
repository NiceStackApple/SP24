
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Phase, 
  Player, 
  PlayerStatus, 
  ActionType, 
  GameState, 
  BattleEvent,
  FirestorePlayer,
  LogType,
  ChatMessage
} from '../types';
import { GAME_CONFIG, NAMES_LIST, ITEMS_LIST } from '../constants';
import { audioManager } from '../services/audioService';
import { storageService } from '../services/storageService';
import { doc, updateDoc, setDoc, onSnapshot, collection, writeBatch, getDocs, increment } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

// --- HELPER FUNCTIONS ---

const getDayDuration = (day: number) => {
  if (day <= 10) return 35;
  if (day < 20) return 30;
  if (day < 30) return 20; 
  return 10;
};

// ... (Rest of helpers remain unchanged) ...
// PHASE BALANCING HELPER (STRICT DAY SCALING)
const getPhaseConfig = (day: number) => {
    if (day >= 30) {
        return { exploreChance: 0.4, zoneDmg: 10 + (day >= 45 ? 10 : 0) };
    }
    if (day >= 21) {
        return { exploreChance: 0.6, zoneDmg: 5 };
    }
    return { exploreChance: 0.8, zoneDmg: 0 };
};

// HELPER FOR INITIAL PLAYER STATE (Copied from useGameRoom to avoid coupling for practice mode)
const getInitialPlayerState = (name: string, isBot: boolean): Player => ({
    id: name,
    name: name,
    isBot: isBot,
    connection_status: 'CONNECTED',
    hp: GAME_CONFIG.START_HP,
    hunger: GAME_CONFIG.START_HUNGER,
    fatigue: GAME_CONFIG.START_FATIGUE,
    inventory: [],
    status: PlayerStatus.ALIVE,
    cooldowns: { eat: 0, rest: 0, run: 0, shoot: 0, eatCount: 0, restCount: 0 },
    activeBuffs: { damageBonus: 0, ignoreFatigue: false },
    lastExploreDay: 0,
    kills: 0,
    hasPistol: false,
    avatarId: Math.floor(Math.random() * 1000) + 1,
    lastAction: null,
    incomingAttacks: [],
    targetId: null
});

// LOG TEMPLATES HELPER
const getLogTemplate = (key: string, params: { source?: string, target?: string, val?: number, item?: string }): string => {
    const { source, target, val, item } = params;
    const variants: string[] = [];

    switch (key) {
        case 'ATTACK_HIT':
            variants.push(`${source} strikes ${target} (-${val} HP).`);
            variants.push(`${source} lands a solid hit on ${target} (-${val} HP).`);
            variants.push(`${target} takes a hit from ${source} (-${val} HP).`);
            break;
        case 'SHOOT_HIT':
            variants.push(`${target} is hit by a precise shot (-${val} HP).`);
            variants.push(`${target} takes a clean shot (-${val} HP).`);
            variants.push(`${source} fires a round into ${target} (-${val} HP).`);
            break;
        case 'ATTACK_BLOCKED':
            variants.push(`${target} blocks the strike.`);
            variants.push(`${target} deflects the attack.`);
            break;
        case 'ATTACK_DODGED':
            variants.push(`${target} dodges the attack.`);
            variants.push(`${target} avoids the blow.`);
            variants.push(`${target} evades the strike.`);
            break;
        case 'EAT':
            variants.push(`${source} eats a ration.`);
            variants.push(`${source} consumes stored food.`);
            break;
        case 'REST':
            variants.push(`${source} rests briefly.`);
            variants.push(`${source} takes a short rest.`);
            break;
        case 'HEAL':
            variants.push(`${source} recovers (+${val} HP).`);
            variants.push(`${source} treats their wounds (+${val} HP).`);
            break;
        case 'RUN_LOOT':
            variants.push(`${source} found ${item}.`);
            variants.push(`${source} scavenged ${item}.`);
            break;
        case 'RUN_FAIL':
            variants.push(`${source} stumbled (-${val} HP).`);
            variants.push(`${source} tripped while running (-${val} HP).`);
            break;
        case 'DEATH':
            variants.push(`${source} has fallen.`);
            variants.push(`${source} died.`);
            variants.push(`${source} collapsed.`);
            break;
        default:
            return '';
    }
    return variants[Math.floor(Math.random() * variants.length)];
};

const calculateBotActions = (currentPlayers: Player[], isVolcanoDay: boolean, isGasDay: boolean, isZoneShrinkDay: boolean, isMonsterDay: boolean) => {
  const botActions: Map<string, { type: ActionType, targetId: string | null }> = new Map();
  
  const activeBots = currentPlayers.filter(p => 
      (p.status === PlayerStatus.ALIVE || p.status === PlayerStatus.STUNNED) &&
      (p.isBot || p.connection_status === 'DISCONNECTED')
  );

  activeBots.forEach(bot => {
    let action = ActionType.NONE;
    let target: string | null = null;

    if (bot.status === PlayerStatus.STUNNED) {
       if (bot.hunger <= 0) action = ActionType.EAT;
       else if (bot.fatigue <= 0) action = ActionType.REST;
       else action = Math.random() > 0.5 ? ActionType.EAT : ActionType.REST; 
       botActions.set(bot.id, { type: action, targetId: null });
       return;
    }

    if (isZoneShrinkDay) action = ActionType.RUN;
    else if (isMonsterDay) action = ActionType.DEFEND;
    else if (isVolcanoDay) action = ActionType.RUN;
    else if (isGasDay) action = ActionType.DEFEND;
    else {
      const lowHunger = bot.hunger < 40;
      const lowFatigue = bot.fatigue < 40;
      const lowHp = bot.hp < 50;
      
      if (lowHunger && bot.cooldowns.eat === 0) action = ActionType.EAT;
      else if (lowFatigue && bot.cooldowns.rest === 0) action = ActionType.REST;
      else if (bot.hasPistol) {
         const enemies = currentPlayers.filter(p => p.id !== bot.id && p.status === PlayerStatus.ALIVE);
         if (enemies.length > 0) {
            action = ActionType.SHOOT;
            target = enemies[Math.floor(Math.random() * enemies.length)].id;
         }
      } else if (lowHp) action = ActionType.DEFEND;
      else {
        if (!bot.isBot && bot.connection_status === 'DISCONNECTED') {
             action = ActionType.DEFEND;
        } else {
             const enemies = currentPlayers.filter(p => p.id !== bot.id && p.status === PlayerStatus.ALIVE);
             if (enemies.length > 0) {
                action = ActionType.ATTACK;
                target = enemies[Math.floor(Math.random() * enemies.length)].id;
             } else action = ActionType.DEFEND;
        }
      }
    }
    botActions.set(bot.id, { type: action, targetId: target });
  });
  return botActions;
};

const destroyRoomForce = async (targetRoomId: string) => {
    try {
        console.log(`Force destroying room ${targetRoomId}...`);
        const playersRef = collection(db, 'rooms', targetRoomId, 'players');
        const snap = await getDocs(playersRef);
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        batch.delete(doc(db, 'rooms', targetRoomId));
        await batch.commit();
    } catch (e) {
        console.error("Failed to destroy room", e);
    }
};

export const useGameEngine = () => {
  const [state, setState] = useState<GameState>({
    phase: Phase.LOBBY,
    day: 1,
    timeLeft: 0,
    players: [],
    logs: [],
    messages: [],
    myPlayerId: null,
    winnerId: null,
    battleQueue: [],
    currentEvent: null,
    roomCode: null,
    isHost: false,
    isPractice: false,
    modal: { isOpen: false, title: '', message: '' },
    volcanoDay: -1,
    gasDay: -1,
    pistolDay: -1,
    volcanoEventActive: false,
    gasEventActive: false,
    monsterEventActive: false,
    nextMonsterDay: GAME_CONFIG.MONSTER_START_DAY
  });

  const [pendingAction, setPendingAction] = useState<{ type: ActionType, targetId?: string | null }>({ type: ActionType.NONE });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameRecordedRef = useRef(false);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    const handleUserInteraction = () => {
      audioManager.ensureContext();
    };
    window.addEventListener('click', handleUserInteraction);
    return () => window.removeEventListener('click', handleUserInteraction);
  }, []);

  // --- FIRESTORE SYNC: PLAYERS (MULTIPLAYER ONLY) ---
  useEffect(() => {
    if (state.isPractice || !state.roomCode || state.phase === Phase.LOBBY) return;

    const unsub = onSnapshot(collection(db, 'rooms', state.roomCode, 'players'), (snapshot) => {
        const remotePlayers = snapshot.docs.map(doc => {
            const data = doc.data() as FirestorePlayer;
            return {
                id: doc.id, 
                name: doc.id, 
                isBot: data.is_bot,
                avatarId: data.avatar_id || 99,
                hp: data.hp,
                hunger: data.hunger,
                fatigue: data.fatigue,
                status: data.status,
                cooldowns: data.cooldowns,
                lastAction: null, 
                incomingAttacks: [],
                targetId: null,
                kills: data.kills,
                hasPistol: data.has_pistol,
                inventory: data.inventory,
                activeBuffs: data.active_buffs,
                lastExploreDay: data.last_explore_day,
                pendingActionType: (doc.id === state.myPlayerId) ? undefined : data.pending_action?.type,
                connection_status: data.connection_status
            } as Player;
        });

        setState(prev => {
            const merged = remotePlayers.map(rp => {
                const existing = prev.players.find(p => p.name === rp.name); 
                if (existing) {
                    return { ...existing, ...rp };
                }
                return rp;
            });
            
            if (merged.length !== prev.players.length) {
                 return { ...prev, players: remotePlayers };
            }
            return { ...prev, players: merged };
        });
    });

    return () => unsub();
  }, [state.roomCode, state.phase, state.myPlayerId, state.isPractice]);


  // --- HOST SYNC: DAY & PHASE (MULTIPLAYER ONLY) ---
  useEffect(() => {
     if (!state.isPractice && state.isHost && state.roomCode && state.phase !== Phase.LOBBY && state.phase !== Phase.GAME_OVER) {
         const roomRef = doc(db, 'rooms', state.roomCode);
         updateDoc(roomRef, {
             current_day: state.day,
             phase: state.phase
         }).catch(console.error);
     }
  }, [state.day, state.phase, state.isHost, state.roomCode, state.isPractice]);

  // --- HOST SYNC: WIN CONDITION (MULTIPLAYER ONLY) ---
  useEffect(() => {
     if (!state.isPractice && state.isHost && state.roomCode && state.phase !== Phase.LOBBY && state.phase !== Phase.GAME_OVER) {
         const aliveCount = state.players.filter(p => p.status === PlayerStatus.ALIVE).length;
         if (aliveCount <= 1) {
             const roomRef = doc(db, 'rooms', state.roomCode);
             updateDoc(roomRef, { status: 'ENDED' }).catch(console.error);
         }
     }
  }, [state.players, state.isHost, state.roomCode, state.phase, state.isPractice]);

  // --- GAME OVER & CLEANUP TIMER ---
  useEffect(() => {
      if (state.phase === Phase.GAME_OVER && !cleanupTimerRef.current) {
          cleanupTimerRef.current = setTimeout(() => {
               if (state.roomCode && !state.isPractice) {
                   console.log("Cleanup timer expired. Deleting room.");
                   destroyRoomForce(state.roomCode).then(() => {
                       leaveGame(); 
                   });
               } else if (state.isPractice) {
                   leaveGame();
               }
          }, 45000);
      }
      return () => {
          if (state.phase !== Phase.GAME_OVER && cleanupTimerRef.current) {
              clearTimeout(cleanupTimerRef.current);
              cleanupTimerRef.current = null;
          }
      };
  }, [state.phase, state.roomCode, state.isPractice]);

  const addLog = useCallback((text: string, type: LogType = 'system', involvedIds: string[] = []) => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, { id: Date.now().toString() + Math.random(), text, type, day: prev.day, involvedIds }]
    }));
  }, []);

  const closeModal = () => {
    setState(prev => ({ ...prev, modal: { ...prev.modal, isOpen: false } }));
  };

  const leaveGame = async () => {
    if (state.roomCode && !state.isPractice) {
         const user = auth.currentUser;
         if (user) {
             const username = user.email?.split('@')[0];
             if (username) {
                 await setDoc(doc(db, 'users', username), { active_session_id: null }, { merge: true });
                 
                 // MANUAL EXIT: Decrement Count
                 try {
                     const roomRef = doc(db, 'rooms', state.roomCode);
                     await updateDoc(roomRef, { player_count: increment(-1) });
                 } catch (e) {
                     console.error("Failed to decrement player count on leave", e);
                 }
             }
         }
    }

    setState({
      phase: Phase.LOBBY,
      day: 1,
      timeLeft: 0,
      players: [],
      logs: [],
      messages: [],
      myPlayerId: null,
      winnerId: null,
      battleQueue: [],
      currentEvent: null,
      roomCode: null,
      isHost: false,
      isPractice: false,
      modal: { isOpen: true, title: 'MENU', message: 'You left the match.' },
      volcanoDay: -1,
      gasDay: -1,
      pistolDay: -1,
      volcanoEventActive: false,
      gasEventActive: false,
      monsterEventActive: false,
      nextMonsterDay: GAME_CONFIG.MONSTER_START_DAY
    });
    setPendingAction({ type: ActionType.NONE });
    audioManager.stopAmbient();
  };

  const claimVictory = async () => {
      if (state.roomCode && !state.isPractice) {
          await destroyRoomForce(state.roomCode);
      }
      leaveGame();
  };

  const surrenderGame = async () => {
      if (!state.isPractice && state.roomCode && state.myPlayerId) {
           const user = auth.currentUser;
           if (user) {
               const username = user.email?.split('@')[0];
               if (username) {
                   await setDoc(doc(db, 'users', username), { active_session_id: null }, { merge: true });
                   try {
                       // MANUAL EXIT: Decrement Count
                       await updateDoc(doc(db, 'rooms', state.roomCode), { player_count: increment(-1) });

                       const playerRef = doc(db, 'rooms', state.roomCode, 'players', username);
                       await updateDoc(playerRef, { 
                           status: 'DEAD', 
                           connection_status: 'DISCONNECTED',
                           hp: 0
                       });
                   } catch (e) {
                       console.warn("Could not update remote player status on surrender", e);
                   }
               }
           }
      }
      
      setState({
        phase: Phase.LOBBY,
        day: 1,
        timeLeft: 0,
        players: [],
        logs: [],
        messages: [],
        myPlayerId: null,
        winnerId: null,
        battleQueue: [],
        currentEvent: null,
        roomCode: null,
        isHost: false,
        isPractice: false,
        modal: { isOpen: true, title: 'SURRENDERED', message: 'You have abandoned the protocol.\nNo statistics were recorded.' },
        volcanoDay: -1,
        gasDay: -1,
        pistolDay: -1,
        volcanoEventActive: false,
        gasEventActive: false,
        monsterEventActive: false,
        nextMonsterDay: GAME_CONFIG.MONSTER_START_DAY
      });
      setPendingAction({ type: ActionType.NONE });
      audioManager.stopAmbient();
  };

  const startGame = (
      playerName: string, 
      roomCode?: string, 
      isHost: boolean = true, 
      existingRoster: string[] = [], 
      startingDay: number = 1,
      startingPhase: Phase = Phase.DAY,
      isPractice: boolean = false
  ) => {
    audioManager.startAmbient();
    audioManager.playConfirm();
    gameRecordedRef.current = false;

    const volcanoDay = Math.floor(Math.random() * (GAME_CONFIG.VOLCANO_MAX_DAY - GAME_CONFIG.VOLCANO_MIN_DAY + 1)) + GAME_CONFIG.VOLCANO_MIN_DAY;
    const gasDay = Math.floor(Math.random() * (GAME_CONFIG.GAS_MAX_DAY - GAME_CONFIG.GAS_MIN_DAY + 1)) + GAME_CONFIG.GAS_MIN_DAY;
    const pistolDay = Math.floor(Math.random() * (GAME_CONFIG.PISTOL_END_DAY - GAME_CONFIG.PISTOL_START_DAY + 1)) + GAME_CONFIG.PISTOL_START_DAY;
    const nextMonsterDay = GAME_CONFIG.MONSTER_START_DAY + Math.floor(Math.random() * 3);
    
    // GENERATE PRACTICE BOTS IF NEEDED
    let initialPlayers: Player[] = [];
    if (isPractice) {
        // Me
        initialPlayers.push(getInitialPlayerState(playerName, false));
        // Bots
        const availableNames = NAMES_LIST.filter(n => n !== playerName);
        for(let i=0; i < 23; i++) {
             let botName = `Bot-${i+1}`;
             if (availableNames.length > 0) {
                 const rIdx = Math.floor(Math.random() * availableNames.length);
                 botName = availableNames[rIdx];
                 availableNames.splice(rIdx, 1);
             }
             initialPlayers.push(getInitialPlayerState(botName, true));
        }
    }

    setState({
      phase: startingPhase,
      day: startingDay,
      timeLeft: getDayDuration(startingDay),
      players: initialPlayers, // Will be populated by onSnapshot in MP
      logs: [{ id: 'start', text: `Day ${startingDay} begins.`, type: 'system', day: startingDay }],
      messages: [],
      myPlayerId: playerName,
      winnerId: null,
      battleQueue: [],
      currentEvent: null,
      roomCode: roomCode || null,
      isHost: isHost,
      isPractice: isPractice,
      modal: {
        isOpen: startingDay === 1,
        title: 'WELCOME TO THE ARENA',
        message: 'Each day, choose one action.\nAt night, all actions will be executed.\n\nTrust no one.'
      },
      volcanoDay,
      gasDay,
      pistolDay,
      volcanoEventActive: false,
      gasEventActive: false,
      monsterEventActive: false,
      nextMonsterDay
    });
  };

  const submitAction = async (type: ActionType, targetId: string | null = null) => {
    if (state.phase !== Phase.DAY) return;
    const me = state.players.find(p => p.id === state.myPlayerId);
    
    if (!me || me.status === PlayerStatus.DEAD) return;
    if (!state.roomCode && !state.isPractice) return; // In MP requires RoomCode, in Practice does not (or uses mock code)
    if (!state.myPlayerId) return;

    if (me.status === PlayerStatus.STUNNED) {
       if (type !== ActionType.EAT && type !== ActionType.REST) {
           audioManager.playError();
           return;
       }
    }
    
    if (state.day >= GAME_CONFIG.LOCKDOWN_DAY) {
        if (type === ActionType.EAT || type === ActionType.REST) {
            audioManager.playError();
            return;
        }
    }
    
    if (type === ActionType.RUN && me.cooldowns.run > 0) return audioManager.playError();
    if (type === ActionType.EAT && me.cooldowns.eat > 0) return audioManager.playError();
    if (type === ActionType.REST && me.cooldowns.rest > 0) return audioManager.playError();
    if (type === ActionType.SHOOT && me.cooldowns.shoot > 0) return audioManager.playError();

    let hCost = 0;
    let fCost = 0;
    switch (type) {
      case ActionType.ATTACK: hCost = GAME_CONFIG.COST_ATTACK_HUNGER; fCost = GAME_CONFIG.COST_ATTACK_FATIGUE; break;
      case ActionType.SHOOT: hCost = GAME_CONFIG.PISTOL_COST_HUNGER; fCost = GAME_CONFIG.PISTOL_COST_FATIGUE; break;
      case ActionType.DEFEND: hCost = GAME_CONFIG.COST_DEFEND_HUNGER; fCost = GAME_CONFIG.COST_DEFEND_FATIGUE; break;
      case ActionType.RUN: hCost = GAME_CONFIG.COST_RUN_HUNGER; fCost = GAME_CONFIG.COST_RUN_FATIGUE; break;
      case ActionType.HEAL: fCost = GAME_CONFIG.COST_HEAL_FATIGUE; break;
    }

    if (me.activeBuffs.ignoreFatigue) {
        fCost = 0;
    }

    if (me.hunger < hCost || me.fatigue < fCost) {
        audioManager.playError();
        return; 
    }

    if (type === ActionType.RUN && me.lastExploreDay === state.day) {
        audioManager.playError();
        return;
    }

    setPendingAction({ type, targetId });
    audioManager.playClick();

    if (state.isPractice) {
        // LOCAL UPDATE ONLY
        setState(prev => ({
            ...prev,
            players: prev.players.map(p => 
                p.id === state.myPlayerId 
                ? { ...p, pendingActionType: type } 
                : p
            )
        }));
    } else if (state.roomCode) {
        // FIRESTORE UPDATE
        try {
            const playerRef = doc(db, 'rooms', state.roomCode, 'players', state.myPlayerId);
            await updateDoc(playerRef, {
                pending_action: { type, target: targetId }
            });
        } catch(e) {
            console.error("Failed to persist action", e);
        }
    }
  };

  const useItem = async (itemName: string) => {
     const me = state.players.find(p => p.id === state.myPlayerId);
     if (!me) return;

     const idx = me.inventory.indexOf(itemName);
     if (idx === -1) return;

     const newInventory = [...me.inventory];
     newInventory.splice(idx, 1);
     
     // Update Object logic
     let updates: any = { inventory: newInventory };

     // Add local log immediately for feedback
     addLog(`${me.name} used ${itemName}.`, 'system', [me.id]);

     if (itemName === 'Bread') { 
         updates.hunger = Math.min(100, me.hunger + 10); 
         audioManager.playEat(); 
     }
     else if (itemName === 'Canned Food') { 
         updates.hunger = Math.min(100, me.hunger + 15); 
         audioManager.playEat(); 
     }
     else if (itemName === 'Bandage') { 
         updates.hp = Math.min(GAME_CONFIG.START_HP, me.hp + 10); 
         audioManager.playConfirm(); 
     }
     else if (itemName === 'Alcohol') { 
         updates.hp = Math.min(GAME_CONFIG.START_HP, me.hp + 7); 
         audioManager.playConfirm(); 
     }
     else if (itemName === 'Sharpening Stone') { 
         updates.active_buffs = { ...me.activeBuffs, damageBonus: 15 }; 
         audioManager.playConfirm(); 
     }
     else if (itemName === 'Painkillers') { 
         updates.active_buffs = { ...me.activeBuffs, ignoreFatigue: true }; 
         audioManager.playConfirm(); 
     }

     if (state.isPractice) {
         // LOCAL UPDATE
         setState(prev => ({
             ...prev,
             players: prev.players.map(p => 
                 p.id === state.myPlayerId 
                 ? { 
                     ...p, 
                     inventory: newInventory,
                     hunger: updates.hunger ?? p.hunger,
                     hp: updates.hp ?? p.hp,
                     activeBuffs: updates.active_buffs ? { ...p.activeBuffs, ...updates.active_buffs } : p.activeBuffs
                   } 
                 : p
             )
         }));
     } else if (state.roomCode) {
         // FIRESTORE UPDATE
         try {
             const playerRef = doc(db, 'rooms', state.roomCode, 'players', state.myPlayerId);
             await updateDoc(playerRef, updates);
         } catch (e) {
             console.error("Failed to use item", e);
         }
     }
  };

  const generateNightEvents = useCallback(() => {
    setState(prev => {
      const isVolcanoDay = prev.day === prev.volcanoDay;
      const isGasDay = prev.day === prev.gasDay;
      const isZoneShrinkDay = prev.day === 20 || prev.day === 30 || prev.day === 45;
      const isMonsterDay = prev.day === prev.nextMonsterDay && !isZoneShrinkDay;
      const { exploreChance } = getPhaseConfig(prev.day);

      if (isVolcanoDay) {
         return { ...prev, phase: Phase.NIGHT, volcanoEventActive: true, battleQueue: [], timeLeft: 0 };
      }
      if (isGasDay) {
          return { ...prev, phase: Phase.NIGHT, gasEventActive: true, battleQueue: [], timeLeft: 0 };
      }
      if (isMonsterDay) {
          return { ...prev, phase: Phase.NIGHT, monsterEventActive: true, battleQueue: [], timeLeft: 0 };
      }

      let players = JSON.parse(JSON.stringify(prev.players)) as Player[];
      const botActions = calculateBotActions(players, false, false, isZoneShrinkDay, false);
      const events: BattleEvent[] = [];
      const allActions: Array<{ playerId: string, type: ActionType, targetId: string | null }> = [];
      
      players.forEach(p => {
        if (p.status === PlayerStatus.DEAD) return;
        
        let action = ActionType.NONE;
        let targetId = null;

        if (p.isBot || p.connection_status === 'DISCONNECTED') {
             const botAction = botActions.get(p.id);
             if (botAction) {
                 action = botAction.type;
                 targetId = botAction.targetId;
             }
        } else {
             // For human players in practice, ensure pendingActionType is read if present locally
             // In MP, pendingActionType comes from snapshot
             // In Practice, we set it in submitAction locally
             if ((p as any).pendingActionType) {
                 action = (p as any).pendingActionType;
             }
        }
        
        if (p.id === prev.myPlayerId) {
             action = pendingAction.type;
             targetId = pendingAction.targetId || null;
        }

        p.lastAction = action; 
        allActions.push({ playerId: p.id, type: action, targetId });
      });

      // ... (Rest of event generation logic matches MP) ...
      if (isZoneShrinkDay) {
          allActions.forEach(act => {
              const p = players.find(x => x.id === act.playerId);
              if (!p) return;
              if (act.type !== ActionType.RUN) {
                  p.status = PlayerStatus.DEAD; p.hp = 0;
                  events.push({ 
                      id: Math.random().toString(), 
                      type: 'DEATH', 
                      sourceId: p.id, 
                      description: getLogTemplate('DEATH', { source: p.name }) 
                  });
              }
          });
      }

      const aliveCount = players.filter(p => p.status === PlayerStatus.ALIVE).length;
      const runDisabled = aliveCount <= GAME_CONFIG.FINAL_DUEL_COUNT;
      const defendedPlayers = new Set<string>();
      const escapedPlayers = new Set<string>();

      allActions.forEach(act => {
          const p = players.find(x => x.id === act.playerId);
          if (!p || p.status === PlayerStatus.DEAD) return;
          if (act.type === ActionType.DEFEND) defendedPlayers.add(p.id);
          if (act.type === ActionType.RUN) {
              if (runDisabled) {
                  defendedPlayers.add(p.id);
                  events.push({ id: Math.random().toString(), type: ActionType.DEFEND, sourceId: p.id, description: `${p.name} cornered and forced to fight.` });
              } else if (Math.random() < exploreChance) {
                  escapedPlayers.add(p.id);
                  const rIdx = Math.floor(Math.random() * ITEMS_LIST.length);
                  events.push({ 
                      id: Math.random().toString(), 
                      type: ActionType.RUN, 
                      sourceId: p.id, 
                      isMiss: false, 
                      value: rIdx + 1, 
                      description: getLogTemplate('RUN_LOOT', { source: p.name, item: ITEMS_LIST[rIdx] })
                  });
              } else {
                  events.push({ 
                      id: Math.random().toString(), 
                      type: ActionType.RUN, 
                      sourceId: p.id, 
                      isMiss: true, 
                      value: GAME_CONFIG.RUN_FAIL_DAMAGE, 
                      description: getLogTemplate('RUN_FAIL', { source: p.name, val: GAME_CONFIG.RUN_FAIL_DAMAGE })
                  });
              }
          }
      });

      const combatActions = allActions.filter(a => [ActionType.ATTACK, ActionType.SHOOT, ActionType.EAT, ActionType.REST, ActionType.HEAL].includes(a.type));
      combatActions.sort(() => Math.random() - 0.5);

      combatActions.forEach(act => {
          const attacker = players.find(p => p.id === act.playerId);
          if (!attacker || attacker.status === PlayerStatus.DEAD) return;
          
          if (act.type === ActionType.EAT) events.push({ id: Math.random().toString(), type: ActionType.EAT, sourceId: attacker.id, value: GAME_CONFIG.EAT_REGEN, description: getLogTemplate('EAT', { source: attacker.name }) });
          if (act.type === ActionType.REST) events.push({ id: Math.random().toString(), type: ActionType.REST, sourceId: attacker.id, value: GAME_CONFIG.REST_REGEN, description: getLogTemplate('REST', { source: attacker.name }) });
          if (act.type === ActionType.HEAL && act.targetId) events.push({ id: Math.random().toString(), type: ActionType.HEAL, sourceId: attacker.id, targetId: act.targetId, value: GAME_CONFIG.HEAL_AMOUNT, description: getLogTemplate('HEAL', { source: attacker.name, val: GAME_CONFIG.HEAL_AMOUNT }) });
          
          if ((act.type === ActionType.ATTACK || act.type === ActionType.SHOOT) && act.targetId) {
             const target = players.find(p => p.id === act.targetId);
             if (target) {
                 if (target.status === PlayerStatus.DEAD) {
                     events.push({ id: Math.random().toString(), type: act.type, sourceId: attacker.id, targetId: target.id, isMiss: true, description: `${attacker.name} attacks a corpse.` });
                 } else if (escapedPlayers.has(target.id)) {
                     const desc = getLogTemplate('ATTACK_DODGED', { target: target.name });
                     events.push({ id: Math.random().toString(), type: act.type, sourceId: attacker.id, targetId: target.id, isMiss: true, description: desc });
                 } else {
                     let rawDmg = 35; 
                     if (act.type === ActionType.SHOOT) rawDmg = 90;
                     
                     if (defendedPlayers.has(target.id)) {
                         rawDmg *= 0.2;
                         const desc = getLogTemplate('ATTACK_BLOCKED', { target: target.name });
                         events.push({ id: Math.random().toString(), type: act.type, sourceId: attacker.id, targetId: target.id, value: Math.floor(rawDmg), isBlocked: true, description: desc });
                     } else {
                         const key = act.type === ActionType.SHOOT ? 'SHOOT_HIT' : 'ATTACK_HIT';
                         const desc = getLogTemplate(key, { source: attacker.name, target: target.name, val: Math.floor(rawDmg) });
                         events.push({ id: Math.random().toString(), type: act.type, sourceId: attacker.id, targetId: target.id, value: Math.floor(rawDmg), description: desc });
                     }
                 }
             }
          }
      });

      return {
        ...prev,
        phase: Phase.NIGHT,
        battleQueue: events,
        currentEvent: null,
        timeLeft: 0,
        players: players 
      };
    });
  }, [pendingAction]);

  useEffect(() => {
    if (!state.currentEvent) return;
    
    const event = state.currentEvent;
    
    let impactDelay = 200; 
    let totalDuration = 700;
    if (event.type === ActionType.ATTACK) { impactDelay = 700; totalDuration = 1400; }
    else if (event.type === ActionType.SHOOT) { impactDelay = 400; totalDuration = 1000; }
    else if (event.type === 'DEATH') { impactDelay = 200; totalDuration = 1200; }

    const impactTimer = setTimeout(() => {
        setState(prev => {
             let updatedPlayers = prev.players.map(p => ({...p}));
             let logs = [...prev.logs];
             
             updatedPlayers = updatedPlayers.map(p => {
                let newP = { ...p };
                if (p.id === event.sourceId) {
                  if (event.type === ActionType.RUN) {
                      newP.lastExploreDay = prev.day; 
                      if (event.isMiss && event.value) newP.hp = Math.max(0, newP.hp - event.value);
                      if (!event.isMiss && event.value) {
                          const itemName = ITEMS_LIST[(event.value as number) - 1];
                          if (itemName) newP.inventory.push(itemName);
                      }
                  }
                  if (event.type === ActionType.EAT && event.value) {
                      newP.hunger = Math.min(100, newP.hunger + event.value);
                      newP.hp = Math.min(GAME_CONFIG.START_HP, newP.hp + 5);
                  }
                  if (event.type === ActionType.REST && event.value) {
                      newP.fatigue = Math.min(100, newP.fatigue + event.value);
                      newP.hp = Math.min(GAME_CONFIG.START_HP, newP.hp + 5);
                  }
                }
                if (event.targetId === p.id) {
                   if ((event.type === ActionType.ATTACK || event.type === ActionType.SHOOT) && !event.isMiss && event.value) {
                       newP.hp -= event.value;
                   }
                   if (event.type === ActionType.HEAL && event.value) {
                       newP.hp = Math.min(GAME_CONFIG.START_HP, newP.hp + event.value);
                   }
                }
                
                if (newP.hp <= 0 && newP.status !== PlayerStatus.DEAD) {
                    newP.status = PlayerStatus.DEAD;
                    newP.hp = 0;
                    logs.push({ 
                        id: Date.now().toString(), 
                        text: getLogTemplate('DEATH', { source: newP.name }), 
                        type: 'death', 
                        day: prev.day, 
                        involvedIds: [newP.id] 
                    });
                    audioManager.playDeath();
                }
                return newP;
             });

             // DB SYNC IF HOST (AND NOT PRACTICE)
             if (!state.isPractice && state.isHost && state.roomCode) {
                 const source = updatedPlayers.find(p => p.id === event.sourceId);
                 const target = updatedPlayers.find(p => p.id === event.targetId);
                 const updates: any[] = [];
                 
                 if (source) {
                     let newHunger = source.hunger;
                     let newFatigue = source.fatigue;

                     switch(event.type) {
                        case ActionType.ATTACK: 
                            newHunger -= GAME_CONFIG.COST_ATTACK_HUNGER;
                            if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_ATTACK_FATIGUE;
                            break;
                        case ActionType.DEFEND: 
                            newHunger -= GAME_CONFIG.COST_DEFEND_HUNGER;
                            if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_DEFEND_FATIGUE;
                            break;
                        case ActionType.RUN: 
                            newHunger -= GAME_CONFIG.COST_RUN_HUNGER;
                            if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_RUN_FATIGUE;
                            break;
                        case ActionType.SHOOT: 
                            newHunger -= GAME_CONFIG.PISTOL_COST_HUNGER;
                            if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.PISTOL_COST_FATIGUE;
                            break;
                        case ActionType.HEAL:
                            if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_HEAL_FATIGUE;
                            break;
                     }
                     
                     updates.push({ 
                         ref: doc(db, 'rooms', state.roomCode, 'players', source.name),
                         data: { 
                             hp: source.hp, 
                             hunger: Math.max(0, Math.min(100, newHunger)), 
                             fatigue: Math.max(0, Math.min(100, newFatigue)), 
                             inventory: source.inventory, 
                             status: source.status,
                             last_explore_day: source.lastExploreDay || 0
                         } 
                     });
                 }
                 if (target && target.id !== source?.id) {
                     updates.push({ 
                         ref: doc(db, 'rooms', state.roomCode, 'players', target.name),
                         data: { 
                             hp: target.hp, 
                             hunger: target.hunger, 
                             fatigue: target.fatigue, 
                             status: target.status 
                         } 
                     });
                 }
                 updates.forEach(u => updateDoc(u.ref, u.data).catch(console.error));
             } else if (state.isPractice) {
                 // LOCAL COST DEDUCTION FOR PRACTICE
                 const source = updatedPlayers.find(p => p.id === event.sourceId);
                 if (source) {
                     let newHunger = source.hunger;
                     let newFatigue = source.fatigue;
                     switch(event.type) {
                        case ActionType.ATTACK: 
                            newHunger -= GAME_CONFIG.COST_ATTACK_HUNGER;
                            if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_ATTACK_FATIGUE;
                            break;
                        case ActionType.DEFEND: 
                            newHunger -= GAME_CONFIG.COST_DEFEND_HUNGER;
                            if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_DEFEND_FATIGUE;
                            break;
                        case ActionType.RUN: 
                            newHunger -= GAME_CONFIG.COST_RUN_HUNGER;
                            if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_RUN_FATIGUE;
                            break;
                        case ActionType.SHOOT: 
                            newHunger -= GAME_CONFIG.PISTOL_COST_HUNGER;
                            if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.PISTOL_COST_FATIGUE;
                            break;
                        case ActionType.HEAL:
                            if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_HEAL_FATIGUE;
                            break;
                     }
                     source.hunger = Math.max(0, Math.min(100, newHunger));
                     source.fatigue = Math.max(0, Math.min(100, newFatigue));
                 }
             }

             const involvedIds = event.type === ActionType.SHOOT 
                ? [event.targetId].filter(Boolean) as string[] 
                : [event.sourceId, event.targetId].filter(Boolean) as string[];

             let logType: LogType = 'system';
             if (event.type === 'DEATH') logType = 'death';
             else if (event.type === ActionType.EAT) logType = 'eat';
             else if (event.type === ActionType.REST) logType = 'rest';
             else if (event.type === ActionType.HEAL) logType = 'heal';
             else if (event.type === ActionType.RUN) {
                 if (event.isMiss) logType = 'system'; 
                 else logType = 'item'; 
             }
             else if (event.type === ActionType.ATTACK || event.type === ActionType.SHOOT) {
                 if (event.isBlocked || (event.isMiss && !event.value)) logType = 'defense';
                 else if (event.isMiss) logType = 'defense'; 
                 else logType = 'damage';
             }

             logs.push({ 
                 id: event.id, 
                 text: event.description, 
                 type: logType, 
                 day: prev.day, 
                 involvedIds 
             });
             
             if (event.type === ActionType.ATTACK) audioManager.playAttack();
             if (event.type === ActionType.SHOOT) audioManager.playAttack();
             if (event.type === ActionType.DEFEND) audioManager.playDefend();
             if (event.type === ActionType.HEAL) audioManager.playConfirm();
             if (event.type === ActionType.EAT) audioManager.playEat();
             if (event.type === ActionType.REST) audioManager.playRest();
             if (event.type === ActionType.RUN) audioManager.playRun();

             return { ...prev, players: updatedPlayers, logs };
        });
    }, impactDelay);

    const cleanupTimer = setTimeout(() => {
        setState(prev => ({ ...prev, currentEvent: null }));
    }, totalDuration);

    return () => {
        clearTimeout(impactTimer);
        clearTimeout(cleanupTimer);
    };
  }, [state.currentEvent, state.isHost, state.roomCode, state.isPractice]);
  
  useEffect(() => {
      if (state.phase === Phase.GAME_OVER && state.winnerId === state.myPlayerId && !gameRecordedRef.current && !state.isPractice) {
          storageService.updateStats({ won: true });
          gameRecordedRef.current = true;
      }
  }, [state.phase, state.winnerId, state.myPlayerId, state.isPractice]);

  useEffect(() => {
    if (state.phase === Phase.DAY && state.timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
      }, 1000);
    } else if (state.phase === Phase.DAY && state.timeLeft === 0) {
      audioManager.playPhaseNight();
      generateNightEvents();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.phase, state.timeLeft, generateNightEvents]);

  useEffect(() => {
    if (state.phase !== Phase.NIGHT) return;
    if (state.currentEvent) return;

    let delay = 1000;
    if (state.gasEventActive) delay = 8000;
    else if (state.volcanoEventActive) delay = 5000;
    else if (state.monsterEventActive) delay = 5000;

    if (state.battleQueue.length > 0) {
       const t = setTimeout(() => {
         setState(prev => {
            const [nextEvent, ...remaining] = prev.battleQueue;
            if (nextEvent.type === 'STUN') audioManager.playError();
            return {
               ...prev,
               currentEvent: nextEvent,
               battleQueue: remaining,
               logs: [...prev.logs]
            };
         });
       }, 100);
       return () => clearTimeout(t);
    } else {
       const t = setTimeout(() => {
          setState(prev => {
             const alive = prev.players.filter(p => p.status === PlayerStatus.ALIVE);
             
             if (alive.length <= 1) {
                 return {
                    ...prev,
                    phase: Phase.GAME_OVER,
                    winnerId: alive.length === 1 ? alive[0].id : null,
                    logs: [...prev.logs, { id: 'gameover', text: 'MATCH ENDED.', type: 'system', day: prev.day }]
                 };
             }

             const nextDay = prev.day + 1;
             
             if (!prev.isPractice && prev.isHost && prev.roomCode) {
                 // DB COOLDOWN RESET (MP)
                 prev.players.forEach(p => {
                     let runCD = Math.max(0, p.cooldowns.run - 1);
                     if (p.lastAction === ActionType.RUN) runCD = 1; 
                     
                     updateDoc(doc(db, 'rooms', prev.roomCode!, 'players', p.name), {
                         'cooldowns.run': runCD,
                         'cooldowns.eat': Math.max(0, p.cooldowns.eat - 1),
                         'cooldowns.rest': Math.max(0, p.cooldowns.rest - 1),
                         'cooldowns.shoot': Math.max(0, p.cooldowns.shoot - 1),
                         'pending_action': { type: 'NONE', target: null },
                         'active_buffs.ignoreFatigue': false
                     });
                 });
             } else if (prev.isPractice) {
                 // LOCAL COOLDOWN RESET (PRACTICE)
                 prev.players.forEach(p => {
                     let runCD = Math.max(0, p.cooldowns.run - 1);
                     if (p.lastAction === ActionType.RUN) runCD = 1;

                     p.cooldowns.run = runCD;
                     p.cooldowns.eat = Math.max(0, p.cooldowns.eat - 1);
                     p.cooldowns.rest = Math.max(0, p.cooldowns.rest - 1);
                     p.cooldowns.shoot = Math.max(0, p.cooldowns.shoot - 1);
                     if (p.pendingActionType) delete p.pendingActionType; // Clear helpers
                     p.activeBuffs.ignoreFatigue = false;
                 });
             }

             audioManager.playPhaseDay();

             return {
                ...prev,
                phase: Phase.DAY,
                day: nextDay,
                timeLeft: getDayDuration(nextDay),
                players: prev.players, 
                logs: [...prev.logs, { id: `day${nextDay}`, text: `Day ${nextDay} begins.`, type: 'system', day: nextDay }],
                volcanoEventActive: false,
                gasEventActive: false,
                monsterEventActive: false
             };
          });
          setPendingAction({ type: ActionType.NONE });
       }, delay);
       return () => clearTimeout(t);
    }
  }, [state.phase, state.battleQueue, state.currentEvent, state.volcanoEventActive, state.gasEventActive, state.monsterEventActive]);

  const sendChatMessage = (text: string, recipientId?: string) => {
    const me = state.players.find(p => p.id === state.myPlayerId);
    if (!me) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString() + Math.random(),
      senderId: me.id,
      senderName: me.name,
      text,
      timestamp: Date.now(),
      isWhisper: !!recipientId,
      recipientId,
      recipientName: recipientId ? state.players.find(p => p.id === recipientId)?.name : undefined
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage]
    }));
  };
  
  return {
    state,
    startGame,
    submitAction,
    useItem,
    leaveGame,
    surrenderGame,
    claimVictory,
    pendingAction,
    sendChatMessage,
    closeModal
  };
};

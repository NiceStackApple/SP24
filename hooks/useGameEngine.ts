
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
  ChatMessage,
  LogEntry
} from '../types';
import { GAME_CONFIG, NAMES_LIST, ITEMS_LIST } from '../constants';
import { audioManager } from '../services/audioService';
import { storageService } from '../services/storageService';
import { doc, updateDoc, setDoc, onSnapshot, collection, writeBatch, getDocs, increment, addDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

// --- HELPER FUNCTIONS ---

const getDayDuration = (day: number) => {
  if (day <= 10) return 35;
  if (day <= 20) return 30;
  if (day <= 30) return 20; 
  if (day <= 44) return 20; // 31-44 is 20s
  if (day <= 54) return 15; // 45-54 is 15s
  return 12; // 55+ is 12s
};

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

// HELPER FOR INITIAL PLAYER STATE
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
            // PISTOL RULE: Anonymous Source
            variants.push(`${target} was shot (-${val} HP).`);
            variants.push(`${target} took a bullet (-${val} HP).`);
            variants.push(`${target} hit by gunfire (-${val} HP).`);
            variants.push(`Stray bullet hit ${target} (-${val} HP).`);
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
            variants.push(`${source} heals ${target} (+${val} HP).`);
            variants.push(`${source} treats ${target}'s wounds (+${val} HP).`);
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
    zoneShrinkActive: false,
    monsterEventActive: false,
    nextMonsterDay: GAME_CONFIG.MONSTER_START_DAY,
    adminNoCost: false,
    forceEventType: null,
    activeWarning: null
  });

  const [pendingAction, setPendingAction] = useState<{ type: ActionType, targetId?: string | null }>({ type: ActionType.NONE });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameRecordedRef = useRef(false);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStateUpdateRef = useRef<number>(Date.now());
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const handleUserInteraction = () => { audioManager.ensureContext(); };
    window.addEventListener('click', handleUserInteraction);
    return () => window.removeEventListener('click', handleUserInteraction);
  }, []);

  useEffect(() => { lastStateUpdateRef.current = Date.now(); }, [state.phase, state.currentEvent, state.battleQueue.length]);

  useEffect(() => {
      if (state.phase === Phase.NIGHT) {
          watchdogRef.current = setInterval(() => {
              const now = Date.now();
              const elapsed = now - lastStateUpdateRef.current;
              if (state.currentEvent && elapsed > 15000) {
                  setState(prev => ({ ...prev, currentEvent: null }));
                  lastStateUpdateRef.current = Date.now();
              }
              else if (!state.currentEvent && state.battleQueue.length === 0 && elapsed > 15000) {
                  startNextDaySafe();
                  lastStateUpdateRef.current = Date.now();
              }
          }, 2000);
      } else {
          if (watchdogRef.current) clearInterval(watchdogRef.current);
      }
      return () => { if (watchdogRef.current) clearInterval(watchdogRef.current); }
  }, [state.phase, state.currentEvent, state.battleQueue]);

  const startNextDaySafe = useCallback(() => {
      setState(prev => {
         const alive = prev.players.filter(p => p.status === PlayerStatus.ALIVE);
         if (alive.length <= 1) {
             return { ...prev, phase: Phase.GAME_OVER, winnerId: alive.length === 1 ? alive[0].id : null, logs: [...prev.logs, { id: 'gameover', text: 'MATCH ENDED.', type: 'system' as LogType, day: prev.day }] };
         }

         const nextDay = prev.day + 1;
         const logs: LogEntry[] = [...prev.logs, { id: `day${nextDay}`, text: `Day ${nextDay} begins.`, type: 'system' as LogType, day: nextDay }];
         let updatedPlayers = [...prev.players];
         let activeWarning = null;

         const hasPistol = updatedPlayers.some(p => p.hasPistol);
         if (!hasPistol && nextDay >= GAME_CONFIG.PISTOL_START_DAY && nextDay <= GAME_CONFIG.PISTOL_END_DAY) {
             if (Math.random() < GAME_CONFIG.PISTOL_CHANCE || nextDay === GAME_CONFIG.PISTOL_END_DAY) {
                 const luckyIndex = Math.floor(Math.random() * alive.length);
                 const luckyId = alive[luckyIndex].id;
                 updatedPlayers = updatedPlayers.map(p => {
                     if (p.id === luckyId) return { ...p, hasPistol: true };
                     return p;
                 });
                 logs.push({ id: `pistol-sys-${nextDay}`, text: "A hidden cache was found.", type: 'system', day: nextDay });
                 logs.push({ id: `pistol-find-${nextDay}`, text: `${alive[luckyIndex].name} found a PISTOL.`, type: 'item', day: nextDay, involvedIds: [luckyId] });
                 
                 // GUN WARNING NOTIFICATION
                 activeWarning = { 
                   title: "FIREARM DETECTED", 
                   subtitle: "A lethal weapon has been introduced into the arena. Someone is being more dangerous.\n\nKill them or they will kill u.", 
                   theme: 'ZONE' // Use red theme for lethal threats
                 };
             }
         }

         if (!activeWarning) {
           if (nextDay === prev.volcanoDay - 1) {
               activeWarning = { title: "SEISMIC WARNING", subtitle: "Heavy tectonic shifts detected in the eastern sector. Volcano eruption imminent.\n\nRelocate to high ground immediately.", theme: 'VOLCANO' };
           }
           else if (nextDay === prev.gasDay - 1) {
               activeWarning = { title: "TOXIN WARNING", subtitle: "Atmospheric monitors report lethal concentrations of acidic vapor. Sector visibility dropping.\n\nSeal all ventilation and DEFEND your position.", theme: 'ACID' };
           }
           else if (nextDay === 19 || nextDay === 29 || nextDay === 44) { 
               activeWarning = { title: "ZONE WARNING", subtitle: "The security perimeter is scheduled for contraction. Outlying quadrants will be purged.\n\nMove toward the center core or face immediate termination.", theme: 'ZONE' };
           }
           else if (nextDay === prev.nextMonsterDay - 1 && nextDay >= 30) {
               activeWarning = { title: "THREAT WARNING", subtitle: "Unidentified biological signatures detected within the arena walls. Predatory signals confirmed.\n\nStay alert during the night cycle. DEFEND to survive.", theme: 'MONSTER' };
           }
         }

         if (!prev.isPractice && prev.isHost && prev.roomCode) {
             updatedPlayers.forEach(p => {
                 let runCD = Math.max(0, p.cooldowns.run - 1);
                 if (p.lastAction === ActionType.RUN) runCD = 1; 
                 updateDoc(doc(db, 'rooms', prev.roomCode!, 'players', p.name), { 'cooldowns.run': runCD, 'cooldowns.eat': Math.max(0, p.cooldowns.eat - 1), 'cooldowns.rest': Math.max(0, p.cooldowns.rest - 1), 'cooldowns.shoot': Math.max(0, p.cooldowns.shoot - 1), 'pending_action': { type: 'NONE', target: null }, 'active_buffs.ignoreFatigue': false, 'has_pistol': p.hasPistol }).catch(console.error);
             });
         } else if (prev.isPractice) {
             updatedPlayers = updatedPlayers.map(p => {
                 let runCD = Math.max(0, p.cooldowns.run - 1);
                 if (p.lastAction === ActionType.RUN) runCD = 1;
                 const newP = { ...p };
                 newP.cooldowns = { ...p.cooldowns, run: runCD, eat: Math.max(0, p.cooldowns.eat - 1), rest: Math.max(0, p.cooldowns.rest - 1), shoot: Math.max(0, p.cooldowns.shoot - 1) };
                 if (newP.pendingActionType) delete newP.pendingActionType; 
                 newP.activeBuffs = { ...p.activeBuffs, ignoreFatigue: false };
                 return newP;
             });
         }

         audioManager.playPhaseDay();
         return { ...prev, phase: Phase.DAY, day: nextDay, timeLeft: getDayDuration(nextDay), players: updatedPlayers, logs: logs, volcanoEventActive: false, gasEventActive: false, monsterEventActive: false, zoneShrinkActive: false, forceEventType: null, activeWarning: activeWarning as any };
      });
      setPendingAction({ type: ActionType.NONE });
  }, []);

  useEffect(() => {
      if (state.activeWarning) {
          const t = setTimeout(() => {
              setState(prev => ({ ...prev, activeWarning: null }));
          }, 7000); // 7 Seconds duration
          return () => clearTimeout(t);
      }
  }, [state.activeWarning]);

  useEffect(() => {
    if (state.isPractice || !state.roomCode || state.phase === Phase.LOBBY) return;
    const unsub = onSnapshot(collection(db, 'rooms', state.roomCode, 'players'), (snapshot) => {
        const remotePlayers = snapshot.docs.map(doc => {
            const data = doc.data() as FirestorePlayer;
            return { id: doc.id, name: doc.id, isBot: data.is_bot, avatarId: data.avatar_id || 99, hp: data.hp, hunger: data.hunger, fatigue: data.fatigue, status: data.status, cooldowns: data.cooldowns, lastAction: null, incomingAttacks: [], targetId: null, kills: data.kills, hasPistol: data.has_pistol, inventory: data.inventory, activeBuffs: data.active_buffs, lastExploreDay: data.last_explore_day, pendingActionType: (doc.id === state.myPlayerId) ? undefined : data.pending_action?.type, connection_status: data.connection_status } as Player;
        });
        setState(prev => {
            const merged = remotePlayers.map(rp => {
                const existing = prev.players.find(p => p.name === rp.name); 
                if (existing) return { ...existing, ...rp };
                return rp;
            });
            if (merged.length !== prev.players.length) return { ...prev, players: remotePlayers };
            return { ...prev, players: merged };
        });
    });
    return () => unsub();
  }, [state.roomCode, state.phase, state.myPlayerId, state.isPractice]);

  useEffect(() => {
     if (!state.isPractice && state.isHost && state.roomCode && state.phase !== Phase.LOBBY && state.phase !== Phase.GAME_OVER) {
         updateDoc(doc(db, 'rooms', state.roomCode), { current_day: state.day, phase: state.phase }).catch(console.error);
     }
  }, [state.day, state.phase, state.isHost, state.roomCode, state.isPractice]);

  useEffect(() => {
     if (!state.isPractice && state.isHost && state.roomCode && state.phase !== Phase.LOBBY && state.phase !== Phase.GAME_OVER) {
         const aliveCount = state.players.filter(p => p.status === PlayerStatus.ALIVE).length;
         if (aliveCount <= 1) {
             updateDoc(doc(db, 'rooms', state.roomCode), { status: 'ENDED' }).catch(console.error);
         }
     }
  }, [state.players, state.isHost, state.roomCode, state.phase, state.isPractice]);

  useEffect(() => {
      if (state.phase === Phase.GAME_OVER && !cleanupTimerRef.current) {
          cleanupTimerRef.current = setTimeout(() => {
               if (state.roomCode && !state.isPractice) {
                   destroyRoomForce(state.roomCode).then(() => { leaveGame(); });
               } else if (state.isPractice) {
                   leaveGame();
               }
          }, 45000);
      }
      return () => { if (state.phase !== Phase.GAME_OVER && cleanupTimerRef.current) { clearTimeout(cleanupTimerRef.current); cleanupTimerRef.current = null; } };
  }, [state.phase, state.roomCode, state.isPractice]);

  const addLog = useCallback((text: string, type: LogType = 'system', involvedIds: string[] = []) => {
    setState(prev => ({ ...prev, logs: [...prev.logs, { id: Date.now().toString() + Math.random(), text, type, day: prev.day, involvedIds }] }));
  }, []);

  const adminSetDay = (d: number) => {
      if (!state.isPractice) return;
      setState(prev => ({ ...prev, day: d, logs: [...prev.logs, { id: Date.now().toString(), text: `ADMIN: Day set to ${d}`, type: 'system', day: d }] }));
  };

  const adminTriggerEvent = (type: string) => {
      if (!state.isPractice) return;
      if (type === 'PISTOL') {
          setState(prev => ({ ...prev, players: prev.players.map(p => p.id === prev.myPlayerId ? { ...p, hasPistol: true } : p), logs: [...prev.logs, { id: Date.now().toString(), text: `ADMIN: Pistol granted.`, type: 'system', day: prev.day }] }));
          return;
      }
      setState(prev => ({ ...prev, forceEventType: type as any, timeLeft: 0 }));
  };

  const adminKillPlayer = (id: string) => {
      if (!state.isPractice) return;
      setState(prev => ({ ...prev, players: prev.players.map(p => { if (p.id === id) return { ...p, hp: 0, status: PlayerStatus.DEAD }; return p; }), logs: [...prev.logs, { id: Date.now().toString(), text: `ADMIN: Executed ${prev.players.find(p=>p.id===id)?.name}.`, type: 'death', day: prev.day }] }));
  };

  const adminToggleNoCost = () => { if (!state.isPractice) return; setState(prev => ({ ...prev, adminNoCost: !prev.adminNoCost })); };

  const adminWinGame = () => { if (!state.isPractice) return; setState(prev => ({ ...prev, phase: Phase.GAME_OVER, winnerId: prev.myPlayerId, logs: [...prev.logs, { id: Date.now().toString(), text: `ADMIN: Force Victory.`, type: 'system', day: prev.day }] })); };

  const closeModal = () => { setState(prev => ({ ...prev, modal: { ...prev.modal, isOpen: false } })); };

  const closeWarning = () => { setState(prev => ({ ...prev, activeWarning: null })); };

  const leaveGame = async () => {
    if (state.roomCode && !state.isPractice) {
         const user = auth.currentUser;
         if (user) {
             const username = user.email?.split('@')[0];
             if (username) {
                 await setDoc(doc(db, 'users', username), { active_session_id: null }, { merge: true });
                 try { await updateDoc(doc(db, 'rooms', state.roomCode), { player_count: increment(-1) }); } catch (e) { console.error("Failed to decrement player count on leave", e); }
             }
         }
    }
    setState({ phase: Phase.LOBBY, day: 1, timeLeft: 0, players: [], logs: [], messages: [], myPlayerId: null, winnerId: null, battleQueue: [], currentEvent: null, roomCode: null, isHost: false, isPractice: false, modal: { isOpen: true, title: 'MENU', message: 'You left the match.' }, volcanoDay: -1, gasDay: -1, pistolDay: -1, volcanoEventActive: false, gasEventActive: false, monsterEventActive: false, zoneShrinkActive: false, nextMonsterDay: GAME_CONFIG.MONSTER_START_DAY, adminNoCost: false, forceEventType: null, activeWarning: null });
    setPendingAction({ type: ActionType.NONE });
    audioManager.stopAmbient();
  };

  const surrenderGame = async () => {
      if (!state.isPractice && state.roomCode && state.myPlayerId) {
           const user = auth.currentUser;
           if (user) {
               const username = user.email?.split('@')[0];
               if (username) {
                   await setDoc(doc(db, 'users', username), { active_session_id: null }, { merge: true });
                   try { await updateDoc(doc(db, 'rooms', state.roomCode), { player_count: increment(-1) }); await updateDoc(doc(db, 'rooms', state.roomCode, 'players', username), { status: 'DEAD' as any, connection_status: 'DISCONNECTED' as any, hp: 0 }); } catch (e) { console.warn("Could not update remote player status on surrender", e); }
               }
           }
      }
      setState({ phase: Phase.LOBBY, day: 1, timeLeft: 0, players: [], logs: [], messages: [], myPlayerId: null, winnerId: null, battleQueue: [], currentEvent: null, roomCode: null, isHost: false, isPractice: false, modal: { isOpen: true, title: 'SURRENDERED', message: 'You have abandoned the protocol.\nNo statistics were recorded.' }, volcanoDay: -1, gasDay: -1, pistolDay: -1, volcanoEventActive: false, gasEventActive: false, monsterEventActive: false, zoneShrinkActive: false, nextMonsterDay: GAME_CONFIG.MONSTER_START_DAY, adminNoCost: false, forceEventType: null, activeWarning: null });
      setPendingAction({ type: ActionType.NONE });
      audioManager.stopAmbient();
  };

  const claimVictory = async () => { if (state.roomCode && !state.isPractice) { await destroyRoomForce(state.roomCode); } leaveGame(); };

  const startGame = (playerName: string, roomCode?: string, isHost: boolean = true, existingRoster: string[] = [], startingDay: number = 1, startingPhase: Phase = Phase.DAY, isPractice: boolean = false) => {
    audioManager.startAmbient();
    audioManager.playConfirm();
    gameRecordedRef.current = false;
    const volcanoDay = Math.floor(Math.random() * (GAME_CONFIG.VOLCANO_MAX_DAY - GAME_CONFIG.VOLCANO_MIN_DAY + 1)) + GAME_CONFIG.VOLCANO_MIN_DAY;
    const gasDay = Math.floor(Math.random() * (GAME_CONFIG.GAS_MAX_DAY - GAME_CONFIG.GAS_MIN_DAY + 1)) + GAME_CONFIG.GAS_MIN_DAY;
    const nextMonsterDay = GAME_CONFIG.MONSTER_START_DAY + Math.floor(Math.random() * 3);
    let initialPlayers: Player[] = [];
    if (isPractice) {
        initialPlayers.push(getInitialPlayerState(playerName, false));
        const availableNames = NAMES_LIST.filter(n => n !== playerName);
        for(let i=0; i < 23; i++) {
             let botName = `Bot-${i+1}`;
             if (availableNames.length > 0) { const rIdx = Math.floor(Math.random() * availableNames.length); botName = availableNames[rIdx]; availableNames.splice(rIdx, 1); }
             initialPlayers.push(getInitialPlayerState(botName, true));
        }
    }
    setState({ phase: startingPhase, day: startingDay, timeLeft: getDayDuration(startingDay), players: initialPlayers, logs: [{ id: 'start', text: `Day ${startingDay} begins.`, type: 'system', day: startingDay }], messages: [], myPlayerId: playerName, winnerId: null, battleQueue: [], currentEvent: null, roomCode: roomCode || null, isHost: isHost, isPractice: isPractice, modal: { isOpen: startingDay === 1, title: 'WELCOME TO THE ARENA', message: 'Each day, choose one action.\nAt night, all actions will be executed.\n\nTrust no one.' }, volcanoDay, gasDay, pistolDay: -1, volcanoEventActive: false, gasEventActive: false, zoneShrinkActive: false, monsterEventActive: false, nextMonsterDay, adminNoCost: false, forceEventType: null, activeWarning: null });
  };

  const submitAction = async (type: ActionType, targetId: string | null = null) => {
    if (state.phase !== Phase.DAY) return;
    const me = state.players.find(p => p.id === state.myPlayerId);
    if (!me || me.status === PlayerStatus.DEAD) return;
    if (!state.roomCode && !state.isPractice) return; 
    if (!state.myPlayerId) return;
    if (me.status === PlayerStatus.STUNNED) { if (type !== ActionType.EAT && type !== ActionType.REST) { audioManager.playError(); return; } }
    if (state.day >= GAME_CONFIG.LOCKDOWN_DAY) { if (type === ActionType.EAT || type === ActionType.REST) { audioManager.playError(); return; } }
    if (!state.adminNoCost) {
        if (type === ActionType.RUN && me.cooldowns.run > 0) return audioManager.playError();
        if (type === ActionType.EAT && me.cooldowns.eat > 0) return audioManager.playError();
        if (type === ActionType.REST && me.cooldowns.rest > 0) return audioManager.playError();
        if (type === ActionType.SHOOT && me.cooldowns.shoot > 0) return audioManager.playError();
        let hCost = 0, fCost = 0;
        switch (type) {
          case ActionType.ATTACK: hCost = GAME_CONFIG.COST_ATTACK_HUNGER; fCost = GAME_CONFIG.COST_ATTACK_FATIGUE; break;
          case ActionType.SHOOT: hCost = GAME_CONFIG.PISTOL_COST_HUNGER; fCost = GAME_CONFIG.PISTOL_COST_FATIGUE; break;
          case ActionType.DEFEND: hCost = GAME_CONFIG.COST_DEFEND_HUNGER; fCost = GAME_CONFIG.COST_DEFEND_FATIGUE; break;
          case ActionType.RUN: hCost = GAME_CONFIG.COST_RUN_HUNGER; fCost = GAME_CONFIG.COST_RUN_FATIGUE; break;
          case ActionType.HEAL: fCost = GAME_CONFIG.COST_HEAL_FATIGUE; break;
        }
        if (me.activeBuffs.ignoreFatigue) fCost = 0;
        if (me.hunger < hCost || me.fatigue < fCost) { audioManager.playError(); return; }
        if (type === ActionType.RUN && me.lastExploreDay === state.day) { audioManager.playError(); return; }
    }
    setPendingAction({ type, targetId });
    audioManager.playClick();
    if (state.isPractice) { setState(prev => ({ ...prev, players: prev.players.map(p => p.id === state.myPlayerId ? { ...p, pendingActionType: type } : p) })); } else if (state.roomCode) { try { await updateDoc(doc(db, 'rooms', state.roomCode, 'players', state.myPlayerId), { pending_action: { type, target: targetId } }); } catch(e) { console.error("Failed to persist action", e); } }
  };

  const useItem = async (itemName: string) => {
     const me = state.players.find(p => p.id === state.myPlayerId);
     if (!me) return;
     const idx = me.inventory.indexOf(itemName);
     if (idx === -1) return;
     const newInventory = [...me.inventory];
     newInventory.splice(idx, 1);
     let updates: any = { inventory: newInventory };
     addLog(`${me.name} used ${itemName}.`, 'system', [me.id]);
     if (itemName === 'Bread') { updates.hunger = Math.min(100, me.hunger + 10); audioManager.playEat(); }
     else if (itemName === 'Canned Food') { updates.hunger = Math.min(100, me.hunger + 15); audioManager.playEat(); }
     else if (itemName === 'Bandage') { updates.hp = Math.min(GAME_CONFIG.START_HP, me.hp + 10); audioManager.playConfirm(); }
     else if (itemName === 'Alcohol') { updates.hp = Math.min(GAME_CONFIG.START_HP, me.hp + 7); audioManager.playConfirm(); }
     else if (itemName === 'Sharpening Stone') { updates.active_buffs = { ...me.activeBuffs, damageBonus: 15 }; audioManager.playConfirm(); }
     else if (itemName === 'Painkillers') { updates.active_buffs = { ...me.activeBuffs, ignoreFatigue: true }; audioManager.playConfirm(); }
     if (state.isPractice) { setState(prev => ({ ...prev, players: prev.players.map(p => p.id === state.myPlayerId ? { ...p, inventory: newInventory, hunger: updates.hunger ?? p.hunger, hp: updates.hp ?? p.hp, activeBuffs: updates.active_buffs ? { ...p.activeBuffs, ...updates.active_buffs } : p.activeBuffs } : p) })); } else if (state.roomCode) { try { await updateDoc(doc(db, 'rooms', state.roomCode, 'players', state.myPlayerId), updates); } catch (e) { console.error("Failed to use item", e); } }
  };

  const generateNightEvents = useCallback(() => {
    setState(prev => {
      const isVolcanoDay = prev.day === prev.volcanoDay || prev.forceEventType === 'VOLCANO';
      const isGasDay = prev.day === prev.gasDay || prev.forceEventType === 'GAS';
      const isZoneShrinkDay = prev.day === 20 || prev.day === 30 || prev.day === 45 || prev.forceEventType === 'SHRINK';
      const isMonsterDay = (prev.day === prev.nextMonsterDay || prev.forceEventType === 'MONSTER') && !isZoneShrinkDay;
      const { exploreChance } = getPhaseConfig(prev.day);
      let players = JSON.parse(JSON.stringify(prev.players)) as Player[];
      const botActions = calculateBotActions(players, isVolcanoDay, isGasDay, isZoneShrinkDay, isMonsterDay);
      players.forEach(p => {
          if (p.id === prev.myPlayerId) { p.lastAction = pendingAction.type; p.targetId = pendingAction.targetId || null; }
          else if ((p as any).pendingActionType) { p.lastAction = (p as any).pendingActionType; }
          if (p.isBot || p.connection_status === 'DISCONNECTED') { const act = botActions.get(p.id); if (act) { p.lastAction = act.type; p.targetId = act.targetId; } }
      });
      const massEvents: BattleEvent[] = [];
      if (isZoneShrinkDay) { massEvents.push({ id: 'ZONE_EVENT', type: 'ZONE_COLLAPSE', sourceId: 'ENVIRONMENT', description: 'The Zone is collapsing.' }); return { ...prev, phase: Phase.NIGHT, zoneShrinkActive: true, battleQueue: massEvents, timeLeft: 0, players }; }
      if (isVolcanoDay) { players.forEach(p => { if (p.status === PlayerStatus.ALIVE && p.lastAction !== ActionType.RUN) { massEvents.push({ id: Math.random().toString(), type: 'VOLCANO', sourceId: 'ENVIRONMENT', targetId: p.id, value: GAME_CONFIG.VOLCANO_DAMAGE, description: `${p.name} burned by lava (-${GAME_CONFIG.VOLCANO_DAMAGE} HP).` }); } }); return { ...prev, phase: Phase.NIGHT, volcanoEventActive: true, battleQueue: massEvents, timeLeft: 0, players }; }
      if (isGasDay) { players.forEach(p => { if (p.status === PlayerStatus.ALIVE && p.lastAction !== ActionType.DEFEND) { massEvents.push({ id: Math.random().toString(), type: 'POISON', sourceId: 'ENVIRONMENT', targetId: p.id, value: GAME_CONFIG.GAS_DAMAGE, description: `${p.name} choked on gas (-${GAME_CONFIG.GAS_DAMAGE} HP).` }); } }); return { ...prev, phase: Phase.NIGHT, gasEventActive: true, battleQueue: massEvents, timeLeft: 0, players }; }
      if (isMonsterDay) { players.forEach(p => { if (p.status === PlayerStatus.ALIVE && p.lastAction !== ActionType.DEFEND) { const dmg = Math.floor(Math.random() * (GAME_CONFIG.MONSTER_DAMAGE_MAX - GAME_CONFIG.MONSTER_DAMAGE_MIN)) + GAME_CONFIG.MONSTER_DAMAGE_MIN; massEvents.push({ id: Math.random().toString(), type: 'MONSTER', sourceId: 'ENVIRONMENT', targetId: p.id, value: dmg, description: `${p.name} mauled by beast (-${dmg} HP).` }); } }); return { ...prev, phase: Phase.NIGHT, monsterEventActive: true, battleQueue: massEvents, timeLeft: 0, players }; }
      const events: BattleEvent[] = [];
      const allActions: Array<{ playerId: string, type: ActionType, targetId: string | null }> = [];
      players.forEach(p => { if (p.status === PlayerStatus.DEAD) return; allActions.push({ playerId: p.id, type: p.lastAction || ActionType.NONE, targetId: p.targetId }); });
      const aliveCount = players.filter(p => p.status === PlayerStatus.ALIVE).length;
      const runDisabled = aliveCount <= GAME_CONFIG.FINAL_DUEL_COUNT;
      const defendedPlayers = new Set<string>();
      const escapedPlayers = new Set<string>();
      allActions.forEach(act => { const p = players.find(x => x.id === act.playerId); if (!p || p.status === PlayerStatus.DEAD) return; if (act.type === ActionType.DEFEND) defendedPlayers.add(p.id); if (act.type === ActionType.RUN) { if (runDisabled) { defendedPlayers.add(p.id); events.push({ id: Math.random().toString(), type: ActionType.DEFEND, sourceId: p.id, description: `${p.name} cornered and forced to fight.` }); } else if (Math.random() < exploreChance) { escapedPlayers.add(p.id); const rIdx = Math.floor(Math.random() * ITEMS_LIST.length); events.push({ id: Math.random().toString(), type: ActionType.RUN, sourceId: p.id, isMiss: false, value: rIdx + 1, description: getLogTemplate('RUN_LOOT', { source: p.name, item: ITEMS_LIST[rIdx] }) }); } else { events.push({ id: Math.random().toString(), type: ActionType.RUN, sourceId: p.id, isMiss: true, value: GAME_CONFIG.RUN_FAIL_DAMAGE, description: getLogTemplate('RUN_FAIL', { source: p.name, val: GAME_CONFIG.RUN_FAIL_DAMAGE }) }); } } });
      const combatActions = allActions.filter(a => [ActionType.ATTACK, ActionType.SHOOT, ActionType.EAT, ActionType.REST, ActionType.HEAL].includes(a.type));
      combatActions.sort(() => Math.random() - 0.5);
      combatActions.forEach(act => {
          const attacker = players.find(p => p.id === act.playerId);
          if (!attacker || attacker.status === PlayerStatus.DEAD) return;
          if (act.type === ActionType.EAT) events.push({ id: Math.random().toString(), type: ActionType.EAT, sourceId: attacker.id, value: GAME_CONFIG.EAT_REGEN, description: getLogTemplate('EAT', { source: attacker.name }) });
          if (act.type === ActionType.REST) events.push({ id: Math.random().toString(), type: ActionType.REST, sourceId: attacker.id, value: GAME_CONFIG.REST_REGEN, description: getLogTemplate('REST', { source: attacker.name }) });
          if (act.type === ActionType.HEAL && act.targetId) events.push({ id: Math.random().toString(), type: ActionType.HEAL, sourceId: attacker.id, targetId: act.targetId, value: GAME_CONFIG.HEAL_AMOUNT, description: getLogTemplate('HEAL', { source: attacker.name, target: players.find(x=>x.id===act.targetId)?.name || 'target', val: GAME_CONFIG.HEAL_AMOUNT }) });
          if ((act.type === ActionType.ATTACK || act.type === ActionType.SHOOT) && act.targetId) {
             const target = players.find(p => p.id === act.targetId);
             if (target) {
                 if (target.status === PlayerStatus.DEAD) { events.push({ id: Math.random().toString(), type: act.type, sourceId: attacker.id, targetId: target.id, isMiss: true, description: `${attacker.name} attacks a corpse.` }); } else if (escapedPlayers.has(target.id)) { const desc = getLogTemplate('ATTACK_DODGED', { target: target.name }); events.push({ id: Math.random().toString(), type: act.type, sourceId: attacker.id, targetId: target.id, isMiss: true, description: desc }); } else {
                     let rawDmg = 35;
                     if (act.type === ActionType.ATTACK) rawDmg = Math.floor(Math.random() * (GAME_CONFIG.DAMAGE_MAX - GAME_CONFIG.DAMAGE_MIN)) + GAME_CONFIG.DAMAGE_MIN;
                     if (act.type === ActionType.SHOOT) rawDmg = Math.floor(Math.random() * (GAME_CONFIG.PISTOL_DAMAGE_MAX - GAME_CONFIG.PISTOL_DAMAGE_MIN)) + GAME_CONFIG.PISTOL_DAMAGE_MIN;
                     if (attacker.activeBuffs.damageBonus > 0) rawDmg += attacker.activeBuffs.damageBonus;
                     if (defendedPlayers.has(target.id)) { rawDmg *= 0.2; const desc = getLogTemplate('ATTACK_BLOCKED', { target: target.name }); events.push({ id: Math.random().toString(), type: act.type, sourceId: attacker.id, targetId: target.id, value: Math.floor(rawDmg), isBlocked: true, description: desc }); } else { const key = act.type === ActionType.SHOOT ? 'SHOOT_HIT' : 'ATTACK_HIT'; const desc = getLogTemplate(key, { source: attacker.name, target: target.name, val: Math.floor(rawDmg) }); events.push({ id: Math.random().toString(), type: act.type, sourceId: attacker.id, targetId: target.id, value: Math.floor(rawDmg), description: desc }); }
                 }
             }
          }
      });
      return { ...prev, phase: Phase.NIGHT, battleQueue: events, currentEvent: null, timeLeft: 0, players: players };
    });
  }, [pendingAction]);

  useEffect(() => {
    if (!state.currentEvent) return;
    const event = state.currentEvent;
    let impactDelay = 200, totalDuration = 700;
    if (event.type === ActionType.ATTACK) { impactDelay = 700; totalDuration = 1400; }
    else if (event.type === ActionType.SHOOT) { impactDelay = 400; totalDuration = 1000; }
    else if (event.type === ActionType.HEAL) { impactDelay = 200; totalDuration = 1100; }
    else if (event.type === 'DEATH') { impactDelay = 200; totalDuration = 1200; }
    else if (event.type === 'VOLCANO' || event.type === 'POISON' || event.type === 'MONSTER') { impactDelay = 100; totalDuration = 1000; }
    else if (event.type === 'ZONE_COLLAPSE') { impactDelay = 100; totalDuration = 1000; } 
    const impactTimer = setTimeout(() => {
        setState(prev => {
             let updatedPlayers = prev.players.map(p => ({...p}));
             let logs = [...prev.logs];
             if (event.type === 'ZONE_COLLAPSE') {
                 let diedCount = 0;
                 updatedPlayers = updatedPlayers.map(p => { if (p.status === PlayerStatus.ALIVE || p.status === PlayerStatus.STUNNED) { if (p.lastAction !== ActionType.RUN) { p.status = PlayerStatus.DEAD; p.hp = 0; logs.push({ id: Date.now().toString() + Math.random(), text: getLogTemplate('DEATH', { source: p.name }), type: 'death', day: prev.day, involvedIds: [p.id] }); diedCount++; } } return p; });
                 if (diedCount > 0) audioManager.playDeath();
                 if (!state.isPractice && state.isHost && state.roomCode) { updatedPlayers.forEach(p => { updateDoc(doc(db, 'rooms', state.roomCode!, 'players', p.name), { hp: p.hp, status: p.status }).catch(console.error); }); }
                 return { ...prev, players: updatedPlayers, logs };
             }
             updatedPlayers = updatedPlayers.map(p => {
                let newP = { ...p };
                if (p.id === event.sourceId) {
                  if (event.type === ActionType.RUN) { newP.lastExploreDay = prev.day; if (event.isMiss && event.value) newP.hp = Math.max(0, newP.hp - event.value); if (!event.isMiss && event.value) { const itemName = ITEMS_LIST[(event.value as number) - 1]; if (itemName) newP.inventory.push(itemName); } }
                  if (event.type === ActionType.EAT && event.value) { newP.hunger = Math.min(100, newP.hunger + event.value); newP.hp = Math.min(GAME_CONFIG.START_HP, newP.hp + 5); }
                  if (event.type === ActionType.REST && event.value) { newP.fatigue = Math.min(100, newP.fatigue + event.value); newP.hp = Math.min(GAME_CONFIG.START_HP, newP.hp + 5); }
                  if (event.type === ActionType.ATTACK) { newP.activeBuffs = { ...newP.activeBuffs, damageBonus: 0 }; }
                }
                if (event.targetId === p.id) { if ((event.type === ActionType.ATTACK || event.type === ActionType.SHOOT) && !event.isMiss && event.value) { newP.hp -= event.value; } if (event.type === ActionType.HEAL && event.value) { newP.hp = Math.min(GAME_CONFIG.START_HP, newP.hp + event.value); } if ((event.type === 'VOLCANO' || event.type === 'POISON' || event.type === 'MONSTER') && event.value) { newP.hp -= event.value; } }
                if (newP.hp <= 0 && newP.status !== PlayerStatus.DEAD) { newP.status = PlayerStatus.DEAD; newP.hp = 0; logs.push({ id: Date.now().toString(), text: getLogTemplate('DEATH', { source: newP.name }), type: 'death', day: prev.day, involvedIds: [newP.id] }); audioManager.playDeath(); }
                return newP;
             });
             if (!state.isPractice && state.isHost && state.roomCode) {
                 const source = updatedPlayers.find(p => p.id === event.sourceId), target = updatedPlayers.find(p => p.id === event.targetId), updates: any[] = [];
                 if (source && source.id !== 'ENVIRONMENT') {
                     let newHunger = source.hunger, newFatigue = source.fatigue;
                     switch(event.type) {
                        case ActionType.ATTACK: newHunger -= GAME_CONFIG.COST_ATTACK_HUNGER; if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_ATTACK_FATIGUE; break;
                        case ActionType.DEFEND: newHunger -= GAME_CONFIG.COST_DEFEND_HUNGER; if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_DEFEND_FATIGUE; break;
                        case ActionType.RUN: newHunger -= GAME_CONFIG.COST_RUN_HUNGER; if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_RUN_FATIGUE; break;
                        case ActionType.SHOOT: newHunger -= GAME_CONFIG.PISTOL_COST_HUNGER; if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.PISTOL_COST_FATIGUE; break;
                        case ActionType.HEAL: if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_HEAL_FATIGUE; break;
                     }
                     updates.push({ ref: doc(db, 'rooms', state.roomCode, 'players', source.name), data: { hp: source.hp, hunger: Math.max(0, Math.min(100, newHunger)), fatigue: Math.max(0, Math.min(100, newFatigue)), inventory: source.inventory, status: source.status, last_explore_day: source.lastExploreDay || 0, active_buffs: source.activeBuffs } });
                 }
                 if (target && target.id !== source?.id) { updates.push({ ref: doc(db, 'rooms', state.roomCode, 'players', target.name), data: { hp: target.hp, hunger: target.hunger, fatigue: target.fatigue, status: target.status } }); }
                 updates.forEach(u => updateDoc(u.ref, u.data).catch(console.error));
             } else if (state.isPractice) {
                 const source = updatedPlayers.find(p => p.id === event.sourceId);
                 if (source && source.id !== 'ENVIRONMENT') {
                     let newHunger = source.hunger, newFatigue = source.fatigue;
                     if (!state.adminNoCost) {
                         switch(event.type) {
                            case ActionType.ATTACK: newHunger -= GAME_CONFIG.COST_ATTACK_HUNGER; if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_ATTACK_FATIGUE; break;
                            case ActionType.DEFEND: newHunger -= GAME_CONFIG.COST_DEFEND_HUNGER; if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_DEFEND_FATIGUE; break;
                            case ActionType.RUN: newHunger -= GAME_CONFIG.COST_RUN_HUNGER; if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_RUN_FATIGUE; break;
                            case ActionType.SHOOT: newHunger -= GAME_CONFIG.PISTOL_COST_HUNGER; if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.PISTOL_COST_FATIGUE; break;
                            case ActionType.HEAL: if (!source.activeBuffs.ignoreFatigue) newFatigue -= GAME_CONFIG.COST_HEAL_FATIGUE; break;
                         }
                     }
                     source.hunger = Math.max(0, Math.min(100, newHunger)); source.fatigue = Math.max(0, Math.min(100, newFatigue));
                 }
             }
             const involvedIds = event.type === ActionType.SHOOT ? [event.targetId].filter(Boolean) as string[] : [event.sourceId, event.targetId].filter(Boolean) as string[];
             let logType: LogType = 'system';
             if (event.type === 'DEATH') logType = 'death'; else if (event.type === ActionType.EAT) logType = 'eat'; else if (event.type === ActionType.REST) logType = 'rest'; else if (event.type === ActionType.HEAL) logType = 'heal'; else if (event.type === ActionType.RUN) { if (event.isMiss) logType = 'system'; else logType = 'item'; } else if (event.type === ActionType.ATTACK || event.type === ActionType.SHOOT || event.type === 'VOLCANO' || event.type === 'POISON' || event.type === 'MONSTER') { if (event.isBlocked || (event.isBlocked && !event.value)) logType = 'defense'; else if (event.isMiss) logType = 'defense'; else logType = 'damage'; }
             logs.push({ id: event.id, text: event.description, type: logType, day: prev.day, involvedIds });
             if (event.type === ActionType.ATTACK) audioManager.playAttack(); if (event.type === ActionType.SHOOT) audioManager.playAttack(); if (event.type === ActionType.DEFEND) audioManager.playDefend(); if (event.type === ActionType.HEAL) audioManager.playConfirm(); if (event.type === ActionType.EAT) audioManager.playEat(); if (event.type === ActionType.REST) audioManager.playRest(); if (event.type === ActionType.RUN) audioManager.playRun(); if (event.type === 'VOLCANO' || event.type === 'POISON' || event.type === 'MONSTER') audioManager.playAttack();
             return { ...prev, players: updatedPlayers, logs };
        });
    }, impactDelay);
    const cleanupTimer = setTimeout(() => { setState(prev => ({ ...prev, currentEvent: null })); }, totalDuration);
    return () => { clearTimeout(impactTimer); clearTimeout(cleanupTimer); };
  }, [state.currentEvent, state.isHost, state.roomCode, state.isPractice, state.adminNoCost]);
  
  useEffect(() => { if (state.phase === Phase.GAME_OVER && state.winnerId === state.myPlayerId && !gameRecordedRef.current && !state.isPractice) { storageService.updateStats({ won: true }); gameRecordedRef.current = true; } }, [state.phase, state.winnerId, state.myPlayerId, state.isPractice]);

  useEffect(() => {
    if (state.phase === Phase.DAY && state.timeLeft > 0) { timerRef.current = setInterval(() => { setState(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 })); }, 1000); } else if (state.phase === Phase.DAY && state.timeLeft === 0) { audioManager.playPhaseNight(); generateNightEvents(); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.phase, state.timeLeft, generateNightEvents]);

  useEffect(() => {
    if (state.phase !== Phase.NIGHT) return;
    if (state.currentEvent) return;
    let delay = 1000;
    if (state.gasEventActive && state.battleQueue.length === 0) delay = 8000; else if (state.volcanoEventActive && state.battleQueue.length === 0) delay = 10000; else if (state.monsterEventActive && state.battleQueue.length === 0) delay = 5000; else if (state.zoneShrinkActive && state.battleQueue.length === 0) delay = 8000;
    if (state.battleQueue.length > 0) { const t = setTimeout(() => { setState(prev => { const [nextEvent, ...remaining] = prev.battleQueue; return { ...prev, currentEvent: nextEvent, battleQueue: remaining, logs: [...prev.logs] }; }); }, 100); return () => clearTimeout(t); } else { const t = setTimeout(() => { startNextDaySafe(); }, delay); return () => clearTimeout(t); }
  }, [state.phase, state.battleQueue, state.currentEvent, state.volcanoEventActive, state.gasEventActive, state.monsterEventActive, state.zoneShrinkActive, startNextDaySafe]);

  const sendChatMessage = async (text: string, recipientId?: string) => {
      if (!state.myPlayerId) return;
      const me = state.players.find(p => p.id === state.myPlayerId);
      if (!me) return;
      const msg: ChatMessage = { id: Date.now().toString() + Math.random(), senderId: me.id, senderName: me.name, text, timestamp: Date.now(), isWhisper: !!recipientId, recipientId, recipientName: recipientId ? state.players.find(p => p.id === recipientId)?.name : undefined };
      setState(prev => ({ ...prev, messages: [...prev.messages, msg] }));
      if (state.roomCode && !state.isPractice) { try { await addDoc(collection(db, 'rooms', state.roomCode, 'messages'), msg); } catch(e) { console.error("Failed to send message", e); } }
  };

  return { state, startGame, submitAction, useItem, leaveGame, surrenderGame, claimVictory, pendingAction, sendChatMessage, closeModal, closeWarning, adminSetDay, adminTriggerEvent, adminKillPlayer, adminToggleNoCost, adminWinGame };
};

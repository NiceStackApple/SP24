
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Phase, 
  Player, 
  PlayerStatus, 
  ActionType, 
  GameState, 
  LogEntry, 
  ChatMessage, 
  BattleEvent,
  FirestorePlayer
} from '../types';
import { GAME_CONFIG, NAMES_LIST, ITEMS_LIST } from '../constants';
import { audioManager } from '../services/audioService';
import { storageService } from '../services/storageService';
import { doc, updateDoc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

// --- HELPER FUNCTIONS ---

const getDayDuration = (day: number) => {
  if (day <= 10) return 35;
  if (day < 20) return 30;
  if (day < 30) return 20; 
  return 10;
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

const calculateBotActions = (currentPlayers: Player[], isVolcanoDay: boolean, isGasDay: boolean, isZoneShrinkDay: boolean, isMonsterDay: boolean) => {
  const botActions: Map<string, { type: ActionType, targetId: string | null }> = new Map();
  // Include STUNNED players so they can try to recover
  const activeBots = currentPlayers.filter(p => (p.status === PlayerStatus.ALIVE || p.status === PlayerStatus.STUNNED) && p.isBot);

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
        const enemies = currentPlayers.filter(p => p.id !== bot.id && p.status === PlayerStatus.ALIVE);
        if (enemies.length > 0) {
          action = ActionType.ATTACK;
          target = enemies[Math.floor(Math.random() * enemies.length)].id;
        } else action = ActionType.DEFEND;
      }
    }
    botActions.set(bot.id, { type: action, targetId: target });
  });
  return botActions;
};

// --- MAIN HOOK ---

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
  
  // Audio context resume helper
  useEffect(() => {
    const handleUserInteraction = () => {
      audioManager.ensureContext();
    };
    window.addEventListener('click', handleUserInteraction);
    return () => window.removeEventListener('click', handleUserInteraction);
  }, []);

  // --- FIRESTORE SYNC: PLAYERS ---
  // Authoritative state comes from Firestore.
  // We strictly sync HP, Hunger, Fatigue, Inventory, Status from DB.
  useEffect(() => {
    if (!state.roomCode || state.phase === Phase.LOBBY) return;

    const unsub = onSnapshot(collection(db, 'rooms', state.roomCode, 'players'), (snapshot) => {
        const remotePlayers = snapshot.docs.map(doc => {
            const data = doc.data() as FirestorePlayer;
            return {
                id: doc.id, // Strictly use Document ID (Username) to avoid mismatch
                name: doc.id, 
                isBot: data.is_bot,
                avatarId: data.avatar_id || 99, // Sync visual identity
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
                // UI Specific
                pendingActionType: (doc.id === state.myPlayerId) ? undefined : data.pending_action?.type // Peek at others? No.
            } as Player;
        });

        // Merge logic
        setState(prev => {
            const merged = remotePlayers.map(rp => {
                const existing = prev.players.find(p => p.name === rp.name); 
                if (existing) {
                    return {
                        ...existing,
                        hp: rp.hp,
                        hunger: rp.hunger,
                        fatigue: rp.fatigue,
                        inventory: rp.inventory,
                        status: rp.status,
                        cooldowns: rp.cooldowns,
                        activeBuffs: rp.activeBuffs,
                        kills: rp.kills,
                        hasPistol: rp.hasPistol,
                        lastExploreDay: rp.lastExploreDay,
                        avatarId: rp.avatarId
                    };
                }
                return rp;
            });
            
            // If we are missing players locally (e.g. late join), add them
            if (merged.length !== prev.players.length) {
                 return { ...prev, players: remotePlayers };
            }

            return { ...prev, players: merged };
        });
    });

    return () => unsub();
  }, [state.roomCode, state.phase, state.myPlayerId]);


  // --- STATE SYNC (HOST ONLY) ---
  useEffect(() => {
     if (state.isHost && state.roomCode && state.phase !== Phase.LOBBY) {
         const roomRef = doc(db, 'rooms', state.roomCode);
         updateDoc(roomRef, {
             current_day: state.day,
             phase: state.phase
         }).catch(console.error);
     }
  }, [state.day, state.phase, state.isHost, state.roomCode]);

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info', involvedIds: string[] = []) => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, { id: Date.now().toString() + Math.random(), text, type, day: prev.day, involvedIds }]
    }));
  }, []);

  const closeModal = () => {
    setState(prev => ({ ...prev, modal: { ...prev.modal, isOpen: false } }));
  };

  const leaveGame = async () => {
    if (state.roomCode) {
         const user = auth.currentUser;
         if (user) {
             const username = user.email?.split('@')[0];
             if (username) {
                 await setDoc(doc(db, 'users', username), { active_session_id: null }, { merge: true });
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

  const surrenderGame = async () => {
      if (state.roomCode && state.myPlayerId) {
           const user = auth.currentUser;
           if (user) {
               const username = user.email?.split('@')[0];
               if (username) {
                   await setDoc(doc(db, 'users', username), { active_session_id: null }, { merge: true });
                   try {
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
      startingPhase: Phase = Phase.DAY
  ) => {
    audioManager.startAmbient();
    audioManager.playConfirm();
    gameRecordedRef.current = false;

    const volcanoDay = Math.floor(Math.random() * (GAME_CONFIG.VOLCANO_MAX_DAY - GAME_CONFIG.VOLCANO_MIN_DAY + 1)) + GAME_CONFIG.VOLCANO_MIN_DAY;
    const gasDay = Math.floor(Math.random() * (GAME_CONFIG.GAS_MAX_DAY - GAME_CONFIG.GAS_MIN_DAY + 1)) + GAME_CONFIG.GAS_MIN_DAY;
    const pistolDay = Math.floor(Math.random() * (GAME_CONFIG.PISTOL_END_DAY - GAME_CONFIG.PISTOL_START_DAY + 1)) + GAME_CONFIG.PISTOL_START_DAY;
    const nextMonsterDay = GAME_CONFIG.MONSTER_START_DAY + Math.floor(Math.random() * 3);
    
    setState({
      phase: startingPhase,
      day: startingDay,
      timeLeft: getDayDuration(startingDay),
      players: [], // Will populate from Firestore
      logs: [{ id: 'start', text: `Day ${startingDay} Begins.`, type: 'system', day: startingDay }],
      messages: [],
      myPlayerId: playerName,
      winnerId: null,
      battleQueue: [],
      currentEvent: null,
      roomCode: roomCode || null,
      isHost: isHost,
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
    if (!state.roomCode || !state.myPlayerId) return;

    // Strict Stun Validation
    if (me.status === PlayerStatus.STUNNED) {
       if (type !== ActionType.EAT && type !== ActionType.REST) {
           audioManager.playError();
           return;
       }
    }
    
    // Lockdown Validation
    if (state.day >= GAME_CONFIG.LOCKDOWN_DAY) {
        if (type === ActionType.EAT || type === ActionType.REST) {
            audioManager.playError();
            return;
        }
    }
    
    // Cooldown Validation
    if (type === ActionType.RUN && me.cooldowns.run > 0) return audioManager.playError();
    if (type === ActionType.EAT && me.cooldowns.eat > 0) return audioManager.playError();
    if (type === ActionType.REST && me.cooldowns.rest > 0) return audioManager.playError();
    if (type === ActionType.SHOOT && me.cooldowns.shoot > 0) return audioManager.playError();

    // Cost Validation
    let hCost = 0;
    let fCost = 0;
    switch (type) {
      case ActionType.ATTACK: hCost = GAME_CONFIG.COST_ATTACK_HUNGER; fCost = GAME_CONFIG.COST_ATTACK_FATIGUE; break;
      case ActionType.SHOOT: hCost = GAME_CONFIG.PISTOL_COST_HUNGER; fCost = GAME_CONFIG.PISTOL_COST_FATIGUE; break;
      case ActionType.DEFEND: hCost = GAME_CONFIG.COST_DEFEND_HUNGER; fCost = GAME_CONFIG.COST_DEFEND_FATIGUE; break;
      case ActionType.RUN: hCost = GAME_CONFIG.COST_RUN_HUNGER; fCost = GAME_CONFIG.COST_RUN_FATIGUE; break;
      case ActionType.HEAL: fCost = GAME_CONFIG.COST_HEAL_FATIGUE; break;
    }

    if (me.activeBuffs.ignoreFatigue) fCost = 0;

    if (me.hunger < hCost || me.fatigue < fCost) {
        audioManager.playError();
        return; 
    }

    // EXPLORE COOLDOWN CHECK (Rule 3)
    if (type === ActionType.RUN && me.lastExploreDay === state.day) {
        audioManager.playError();
        return;
    }

    // Optimistic Update
    setPendingAction({ type, targetId });
    audioManager.playClick();

    // PERSIST TO FIRESTORE
    try {
        const playerRef = doc(db, 'rooms', state.roomCode, 'players', state.myPlayerId);
        await updateDoc(playerRef, {
            pending_action: { type, target: targetId }
        });
    } catch(e) {
        console.error("Failed to persist action", e);
    }
  };

  const useItem = async (itemName: string) => {
     if (!state.roomCode || !state.myPlayerId) return;
     
     const me = state.players.find(p => p.id === state.myPlayerId);
     if (!me) return;

     // Validate Item Exists
     const idx = me.inventory.indexOf(itemName);
     if (idx === -1) return;

     const newInventory = [...me.inventory];
     newInventory.splice(idx, 1);
     
     let updates: any = { inventory: newInventory };

     // Apply Effect
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

     // PERSIST TO FIRESTORE
     try {
         const playerRef = doc(db, 'rooms', state.roomCode, 'players', state.myPlayerId);
         await updateDoc(playerRef, updates);
     } catch (e) {
         console.error("Failed to use item", e);
     }
  };

  const generateNightEvents = useCallback(() => {
    setState(prev => {
      // ... Logic same as before ...
      const isVolcanoDay = prev.day === prev.volcanoDay;
      const isGasDay = prev.day === prev.gasDay;
      const isZoneShrinkDay = prev.day === 20 || prev.day === 30 || prev.day === 45;
      const isMonsterDay = prev.day === prev.nextMonsterDay && !isZoneShrinkDay;
      const { exploreChance, zoneDmg } = getPhaseConfig(prev.day);

      // --- MASS RESOLUTION FOR VOLCANO ---
      if (isVolcanoDay) {
         return { ...prev, phase: Phase.NIGHT, volcanoEventActive: true, battleQueue: [], timeLeft: 0 };
      }

      // --- MASS RESOLUTION FOR GAS ---
      if (isGasDay) {
          return { ...prev, phase: Phase.NIGHT, gasEventActive: true, battleQueue: [], timeLeft: 0 };
      }

      // --- MASS RESOLUTION FOR MONSTER ---
      if (isMonsterDay) {
          return { ...prev, phase: Phase.NIGHT, monsterEventActive: true, battleQueue: [], timeLeft: 0 };
      }

      // --- STANDARD SEQUENTIAL RESOLUTION ---
      let players = JSON.parse(JSON.stringify(prev.players)) as Player[];
      const botActions = calculateBotActions(players, false, false, isZoneShrinkDay, false);
      const events: BattleEvent[] = [];
      const allActions: Array<{ playerId: string, type: ActionType, targetId: string | null }> = [];
      
      // 1. Assign Actions (Mix of real pending actions and bot logic)
      players.forEach(p => {
        if (p.status === PlayerStatus.DEAD) return;
        
        let action = ActionType.NONE;
        let targetId = null;

        if (p.isBot) {
             const botAction = botActions.get(p.id);
             if (botAction) {
                 action = botAction.type;
                 targetId = botAction.targetId;
             }
        } else {
             // For real players, we trust the 'pendingActionType' populated by the listener from Firestore
             if ((p as any).pendingActionType) {
                 action = (p as any).pendingActionType;
                 // Note: To support precise targeting from remote players, the listener in useGameEngine
                 // needs to also map pending_action.target to the player object.
                 // Currently, remote players only sync stats. 
                 // For now, Host assumes random valid target if pending_action target is missing/null? 
                 // No, we need to read 'pending_action' fully.
                 // The 'state.players' array comes from listener.
                 // But wait! 'state.players' does NOT contain the full pending_action object for everyone, only 'pendingActionType'.
                 // FIX: We need to trust what we have. If target is missing for Attack, we might need random target.
                 // However, for the local player (if I am host), I know my target.
             }
             
             // If I am host, I should probably re-fetch the full pending actions map from Firestore before resolving?
             // Or better: The listener should populate pendingAction completely. 
             // In the interest of keeping this atomic, let's assume Host has enough info or falls back to random target for now.
        }
        
        // Local override for ME (since listener might lag slightly or be same)
        if (p.id === prev.myPlayerId) {
             action = pendingAction.type;
             targetId = pendingAction.targetId || null;
        }

        p.lastAction = action; // Critical for logic
        allActions.push({ playerId: p.id, type: action, targetId });
      });

      // ... [Standard Resolution Logic Same as Before] ...
      // RE-INSERTING BATTLE LOGIC 
      
      // 2. Resolve SHRINKING ZONE
      if (isZoneShrinkDay) {
          allActions.forEach(act => {
              const p = players.find(x => x.id === act.playerId);
              if (!p) return;
              if (act.type !== ActionType.RUN) {
                  p.status = PlayerStatus.DEAD; p.hp = 0;
                  events.push({ id: Math.random().toString(), type: 'DEATH', sourceId: p.id, description: 'Consumed by zone.' });
              }
          });
      }

      const aliveCount = players.filter(p => p.status === PlayerStatus.ALIVE).length;
      const damageMult = aliveCount <= GAME_CONFIG.CRITICAL_PLAYER_COUNT ? GAME_CONFIG.CRITICAL_DAMAGE_MULTIPLIER : 1;
      const runDisabled = aliveCount <= GAME_CONFIG.FINAL_DUEL_COUNT;
      const defendedPlayers = new Set<string>();
      const escapedPlayers = new Set<string>();

      // Process Defends/Runs first
      allActions.forEach(act => {
          const p = players.find(x => x.id === act.playerId);
          if (!p || p.status === PlayerStatus.DEAD) return;
          if (act.type === ActionType.DEFEND) defendedPlayers.add(p.id);
          if (act.type === ActionType.RUN) {
              if (runDisabled) {
                  defendedPlayers.add(p.id);
                  events.push({ id: Math.random().toString(), type: ActionType.DEFEND, sourceId: p.id, description: `${p.name} cornered!` });
              } else if (Math.random() < exploreChance) {
                  escapedPlayers.add(p.id);
                  const rIdx = Math.floor(Math.random() * ITEMS_LIST.length);
                  events.push({ id: Math.random().toString(), type: ActionType.RUN, sourceId: p.id, isMiss: false, value: rIdx + 1, description: `Found ${ITEMS_LIST[rIdx]}` });
              } else {
                  events.push({ id: Math.random().toString(), type: ActionType.RUN, sourceId: p.id, isMiss: true, value: GAME_CONFIG.RUN_FAIL_DAMAGE, description: `Stumbled!` });
              }
          }
      });

      const combatActions = allActions.filter(a => [ActionType.ATTACK, ActionType.SHOOT, ActionType.EAT, ActionType.REST, ActionType.HEAL].includes(a.type));
      combatActions.sort(() => Math.random() - 0.5);

      combatActions.forEach(act => {
          const attacker = players.find(p => p.id === act.playerId);
          if (!attacker || attacker.status === PlayerStatus.DEAD) return;
          if (act.type === ActionType.EAT) events.push({ id: Math.random().toString(), type: ActionType.EAT, sourceId: attacker.id, value: GAME_CONFIG.EAT_REGEN, description: 'Ate.' });
          if (act.type === ActionType.REST) events.push({ id: Math.random().toString(), type: ActionType.REST, sourceId: attacker.id, value: GAME_CONFIG.REST_REGEN, description: 'Rested.' });
          if (act.type === ActionType.HEAL && act.targetId) events.push({ id: Math.random().toString(), type: ActionType.HEAL, sourceId: attacker.id, targetId: act.targetId, value: GAME_CONFIG.HEAL_AMOUNT, description: 'Healed.' });
          
          if ((act.type === ActionType.ATTACK || act.type === ActionType.SHOOT) && act.targetId) {
             const target = players.find(p => p.id === act.targetId);
             if (target) {
                 if (target.status === PlayerStatus.DEAD) {
                     events.push({ id: Math.random().toString(), type: act.type, sourceId: attacker.id, targetId: target.id, isMiss: true, description: 'Hit corpse.' });
                 } else if (escapedPlayers.has(target.id)) {
                     events.push({ id: Math.random().toString(), type: act.type, sourceId: attacker.id, targetId: target.id, isMiss: true, description: 'Dodged.' });
                 } else {
                     let rawDmg = 35; 
                     if (act.type === ActionType.SHOOT) rawDmg = 90;
                     if (defendedPlayers.has(target.id)) {
                         rawDmg *= 0.2;
                         events.push({ id: Math.random().toString(), type: act.type, sourceId: attacker.id, targetId: target.id, value: Math.floor(rawDmg), isBlocked: true, description: 'Blocked.' });
                     } else {
                         events.push({ id: Math.random().toString(), type: act.type, sourceId: attacker.id, targetId: target.id, value: Math.floor(rawDmg), description: 'Hit.' });
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

  // IMPACT LOGIC & WRITE-BACK (HOST)
  useEffect(() => {
    if (!state.currentEvent) return;
    
    const event = state.currentEvent;
    
    // Timing Config
    let impactDelay = 200; 
    let totalDuration = 700;
    if (event.type === ActionType.ATTACK) { impactDelay = 700; totalDuration = 1400; }
    else if (event.type === ActionType.SHOOT) { impactDelay = 400; totalDuration = 1000; }
    else if (event.type === 'DEATH') { impactDelay = 200; totalDuration = 1200; }

    const impactTimer = setTimeout(() => {
        setState(prev => {
             let updatedPlayers = prev.players.map(p => ({...p}));
             let logs = [...prev.logs];
             
             // --- APPLY IMPACTS LOCALLY FOR ANIMATION ---
             updatedPlayers = updatedPlayers.map(p => {
                let newP = { ...p };
                // Source Costs & Self Effects
                if (p.id === event.sourceId) {
                  // Costs applied here? No, visual only.
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
                // Target Damage
                if (event.targetId === p.id) {
                   if ((event.type === ActionType.ATTACK || event.type === ActionType.SHOOT) && !event.isMiss && event.value) {
                       newP.hp -= event.value;
                   }
                   if (event.type === ActionType.HEAL && event.value) {
                       newP.hp = Math.min(GAME_CONFIG.START_HP, newP.hp + event.value);
                   }
                }
                
                // Death Check
                if (newP.hp <= 0 && newP.status !== PlayerStatus.DEAD) {
                    newP.status = PlayerStatus.DEAD;
                    newP.hp = 0;
                    logs.push({ id: Date.now().toString(), text: `${newP.name} died.`, type: 'death', day: prev.day, involvedIds: [newP.id] });
                    audioManager.playDeath();
                }
                return newP;
             });

             // --- AUTHORITATIVE WRITE-BACK (HOST ONLY) ---
             // Rule 2: IMMEDIATELY write updated values to Firestore
             if (state.isHost && state.roomCode) {
                 const source = updatedPlayers.find(p => p.id === event.sourceId);
                 const target = updatedPlayers.find(p => p.id === event.targetId);
                 
                 const updates: any[] = [];
                 
                 if (source) {
                     // APPLY COSTS HERE EXPLICITLY TO FIRESTORE DATA
                     let newHunger = source.hunger;
                     let newFatigue = source.fatigue;

                     // Determine cost based on event type
                     switch(event.type) {
                        case ActionType.ATTACK: 
                            newHunger -= GAME_CONFIG.COST_ATTACK_HUNGER;
                            newFatigue -= GAME_CONFIG.COST_ATTACK_FATIGUE;
                            break;
                        case ActionType.DEFEND: 
                            newHunger -= GAME_CONFIG.COST_DEFEND_HUNGER;
                            newFatigue -= GAME_CONFIG.COST_DEFEND_FATIGUE;
                            break;
                        case ActionType.RUN: 
                            newHunger -= GAME_CONFIG.COST_RUN_HUNGER;
                            newFatigue -= GAME_CONFIG.COST_RUN_FATIGUE;
                            break;
                        case ActionType.SHOOT: 
                            newHunger -= GAME_CONFIG.PISTOL_COST_HUNGER;
                            newFatigue -= GAME_CONFIG.PISTOL_COST_FATIGUE;
                            break;
                        case ActionType.HEAL:
                            newFatigue -= GAME_CONFIG.COST_HEAL_FATIGUE;
                            break;
                        // Eat/Rest costs are negative (gains), handled in effect logic above which modifies `source.hunger`
                        // But for EAT/REST the `source` object above already has the GAIN applied in the visual logic block.
                        // However, standard actions (Attack/Defend) didn't have costs subtracted in visual block.
                     }
                     
                     // Ensure non-negative/max limits for costs (gains already capped in visual block)
                     // If it was Attack, visual block didn't touch hunger. So newHunger has cost deducted.
                     // If it was Eat, visual block ADDED gain. `newHunger` (initially source.hunger which includes gain) is correct.
                     // Wait, `source` is from `updatedPlayers` which ran the visual logic.
                     // Visual logic for Attack: Did NOT change hunger/fatigue. So we subtract now.
                     // Visual logic for Eat: DID add hunger. So we don't subtract anything (cost is time/cooldown, usually 0 stats or negative cost).
                     // Actually EAT has cost: hunger = -30 (Gain). 
                     
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

                 // Execute Writes
                 updates.forEach(u => updateDoc(u.ref, u.data).catch(console.error));
             }

             // Logs & Sound
             const involvedIds = event.type === ActionType.SHOOT 
                ? [event.targetId].filter(Boolean) as string[] 
                : [event.sourceId, event.targetId].filter(Boolean) as string[];

             logs.push({ id: event.id, text: event.description, type: 'combat', day: prev.day, involvedIds });
             
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
  }, [state.currentEvent, state.isHost, state.roomCode]);
  
  // RECORD WIN
  useEffect(() => {
      if (state.phase === Phase.GAME_OVER && state.winnerId === state.myPlayerId && !gameRecordedRef.current) {
          storageService.updateStats({ won: true });
          gameRecordedRef.current = true;
      }
  }, [state.phase, state.winnerId, state.myPlayerId]);

  // --- GAME LOOP ---
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

  // --- NIGHT QUEUE PROCESSOR ---
  useEffect(() => {
    if (state.phase !== Phase.NIGHT) return;
    if (state.currentEvent) return;

    const isMassEvent = state.volcanoEventActive || state.gasEventActive || state.monsterEventActive;
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
             
             // --- RESET FOR NEXT DAY ---
             // Host writes clean reset state
             if (prev.isHost && prev.roomCode) {
                 // For all players, decrement cooldowns
                 prev.players.forEach(p => {
                     let runCD = Math.max(0, p.cooldowns.run - 1);
                     if (p.lastAction === ActionType.RUN) runCD = 1; // 1 day cooldown for run
                     
                     updateDoc(doc(db, 'rooms', prev.roomCode!, 'players', p.name), {
                         'cooldowns.run': runCD,
                         'cooldowns.eat': Math.max(0, p.cooldowns.eat - 1),
                         'cooldowns.rest': Math.max(0, p.cooldowns.rest - 1),
                         'cooldowns.shoot': Math.max(0, p.cooldowns.shoot - 1),
                         'pending_action': { type: 'NONE', target: null } // Clear pending
                     });
                 });
             }

             audioManager.playPhaseDay();

             return {
                ...prev,
                phase: Phase.DAY,
                day: nextDay,
                timeLeft: getDayDuration(nextDay),
                // Players will sync from Firestore, but we update locally to prevent flash
                players: prev.players, 
                logs: [...prev.logs, { id: `day${nextDay}`, text: `Day ${nextDay} Begins.`, type: 'system', day: nextDay }],
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
    pendingAction,
    sendChatMessage,
    closeModal
  };
};

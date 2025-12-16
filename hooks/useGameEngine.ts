
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Phase, 
  Player, 
  PlayerStatus, 
  ActionType, 
  GameState, 
  LogEntry, 
  ChatMessage, 
  BattleEvent 
} from '../types';
import { GAME_CONFIG, NAMES_LIST, ITEMS_LIST } from '../constants';
import { audioManager } from '../services/audioService';
import { storageService } from '../services/storageService';

// --- HELPER FUNCTIONS (MOVED OUTSIDE HOOK) ---

const generateBots = (count: number, startIndex: number = 0): Player[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `bot-${startIndex + i}`,
    name: NAMES_LIST[(startIndex + i) % NAMES_LIST.length] + `-${startIndex + i + 1}`,
    isBot: true,
    avatarId: (startIndex + i) % 70, // Consistent avatar seeding
    hp: GAME_CONFIG.START_HP,
    hunger: GAME_CONFIG.START_HUNGER,
    fatigue: GAME_CONFIG.START_FATIGUE,
    status: PlayerStatus.ALIVE,
    cooldowns: { eat: 0, rest: 0, run: 0, shoot: 0, eatCount: 0, restCount: 0 },
    lastAction: null,
    incomingAttacks: [],
    targetId: null,
    kills: 0,
    hasPistol: false,
    inventory: [],
    activeBuffs: { damageBonus: 0, ignoreFatigue: false }
  }));
};

const getDayDuration = (day: number) => {
  if (day <= 10) return 35;
  if (day < 20) return 30;
  if (day < 30) return 20; 
  return 10;
};

// PHASE BALANCING HELPER (STRICT DAY SCALING)
const getPhaseConfig = (day: number) => {
    // PHASE 3 (FINAL): ENDGAME SURVIVAL (Day 30+)
    if (day >= 30) {
        return {
            exploreChance: 0.4, // 40% Success (Dodge + Loot)
            zoneDmg: 10 + (day >= 45 ? 10 : 0) // Scaling damage for late game
        };
    }
    // PHASE 2: SHRINKING ZONE (Day 21-29)
    if (day >= 21) {
        return {
            exploreChance: 0.6, // 60% Success (Dodge + Loot)
            zoneDmg: 5
        };
    }
    // PHASE 1: EXPLORATION (Day 1-20)
    // Generous early game
    return {
        exploreChance: 0.8, // 80% Success (Dodge + Loot)
        zoneDmg: 0
    };
};

const calculateBotActions = (currentPlayers: Player[], isVolcanoDay: boolean, isGasDay: boolean, isZoneShrinkDay: boolean, isMonsterDay: boolean) => {
  const botActions: Map<string, { type: ActionType, targetId: string | null }> = new Map();
  // Include STUNNED players so they can try to recover
  const activeBots = currentPlayers.filter(p => (p.status === PlayerStatus.ALIVE || p.status === PlayerStatus.STUNNED) && p.isBot);

  activeBots.forEach(bot => {
    let action = ActionType.NONE;
    let target: string | null = null;

    // STUNNED LOGIC
    if (bot.status === PlayerStatus.STUNNED) {
       if (bot.hunger <= 0) action = ActionType.EAT;
       else if (bot.fatigue <= 0) action = ActionType.REST;
       else action = Math.random() > 0.5 ? ActionType.EAT : ActionType.REST; // Default to recovery
       botActions.set(bot.id, { type: action, targetId: null });
       return;
    }

    // FORCED SURVIVAL EVENTS
    if (isZoneShrinkDay) action = ActionType.RUN; // MUST RUN OR DIE (Zone priority)
    else if (isMonsterDay) action = ActionType.DEFEND; // MUST DEFEND (HIDE) from Monsters
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

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info', involvedIds: string[] = []) => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, { id: Date.now().toString() + Math.random(), text, type, day: prev.day, involvedIds }]
    }));
  }, []);

  const closeModal = () => {
    setState(prev => ({ ...prev, modal: { ...prev.modal, isOpen: false } }));
  };

  const leaveGame = () => {
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

  const startGame = (playerName: string, roomCode?: string, isHost: boolean = true, existingRoster: string[] = []) => {
    audioManager.startAmbient();
    audioManager.playConfirm();
    gameRecordedRef.current = false;

    // Create Player Objects from Roster
    const rosterPlayers: Player[] = existingRoster.map((name, idx) => {
      const isMe = name === playerName;
      return {
        id: isMe ? 'player-me' : `remote-${idx}`,
        name: name,
        isBot: false,
        avatarId: isMe ? 99 : idx,
        hp: GAME_CONFIG.START_HP,
        hunger: GAME_CONFIG.START_HUNGER,
        fatigue: GAME_CONFIG.START_FATIGUE,
        status: PlayerStatus.ALIVE,
        cooldowns: { eat: 0, rest: 0, run: 0, shoot: 0, eatCount: 0, restCount: 0 },
        lastAction: null,
        incomingAttacks: [],
        targetId: null,
        kills: 0,
        hasPistol: false,
        inventory: [],
        activeBuffs: { damageBonus: 0, ignoreFatigue: false }
      };
    });

    if (rosterPlayers.length === 0) {
      rosterPlayers.push({
        id: 'player-me',
        name: playerName || 'Player 1',
        isBot: false,
        avatarId: 99,
        hp: GAME_CONFIG.START_HP,
        hunger: GAME_CONFIG.START_HUNGER,
        fatigue: GAME_CONFIG.START_FATIGUE,
        status: PlayerStatus.ALIVE,
        cooldowns: { eat: 0, rest: 0, run: 0, shoot: 0, eatCount: 0, restCount: 0 },
        lastAction: null,
        incomingAttacks: [],
        targetId: null,
        kills: 0,
        hasPistol: false,
        inventory: [],
        activeBuffs: { damageBonus: 0, ignoreFatigue: false }
      });
    }

    const botsNeeded = Math.max(0, GAME_CONFIG.MAX_PLAYERS - rosterPlayers.length);
    const bots = generateBots(botsNeeded, rosterPlayers.length);

    // Randomize Events
    const volcanoDay = Math.floor(Math.random() * (GAME_CONFIG.VOLCANO_MAX_DAY - GAME_CONFIG.VOLCANO_MIN_DAY + 1)) + GAME_CONFIG.VOLCANO_MIN_DAY;
    const gasDay = Math.floor(Math.random() * (GAME_CONFIG.GAS_MAX_DAY - GAME_CONFIG.GAS_MIN_DAY + 1)) + GAME_CONFIG.GAS_MIN_DAY;
    const pistolDay = Math.floor(Math.random() * (GAME_CONFIG.PISTOL_END_DAY - GAME_CONFIG.PISTOL_START_DAY + 1)) + GAME_CONFIG.PISTOL_START_DAY;
    
    // Initial Monster Day around 30-32
    const nextMonsterDay = GAME_CONFIG.MONSTER_START_DAY + Math.floor(Math.random() * 3);
    
    setState({
      phase: Phase.DAY,
      day: 1,
      timeLeft: getDayDuration(1),
      players: [...rosterPlayers, ...bots],
      logs: [{ id: 'start', text: `Day 1 Begins.`, type: 'system', day: 1 }],
      messages: [],
      myPlayerId: 'player-me',
      winnerId: null,
      battleQueue: [],
      currentEvent: null,
      roomCode: roomCode || null,
      isHost: isHost,
      modal: {
        isOpen: true,
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

  const submitAction = (type: ActionType, targetId: string | null = null) => {
    if (state.phase !== Phase.DAY) return;
    const me = state.players.find(p => p.id === state.myPlayerId);
    if (!me || me.status === PlayerStatus.DEAD) return;
    
    // Strict Stun Validation
    if (me.status === PlayerStatus.STUNNED) {
       if (type !== ActionType.EAT && type !== ActionType.REST) {
           audioManager.playError();
           return;
       }
    }
    
    // Lockdown Validation (Day 50+)
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

    // Cost Validation (MANDATORY BEFORE ACTION)
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

    setPendingAction({ type, targetId });
    audioManager.playClick();
  };

  const useItem = (itemName: string) => {
     setState(prev => {
        const players = prev.players.map(p => {
           if (p.id === prev.myPlayerId) {
              const newInventory = [...p.inventory];
              const idx = newInventory.indexOf(itemName);
              if (idx === -1) return p;
              newInventory.splice(idx, 1);
              let newP = { ...p, inventory: newInventory };

              if (itemName === 'Bread') { newP.hunger = Math.min(GAME_CONFIG.START_HUNGER, newP.hunger + 10); audioManager.playEat(); }
              else if (itemName === 'Canned Food') { newP.hunger = Math.min(GAME_CONFIG.START_HUNGER, newP.hunger + 15); audioManager.playEat(); }
              else if (itemName === 'Bandage') { newP.hp = Math.min(GAME_CONFIG.START_HP, newP.hp + 10); audioManager.playConfirm(); }
              else if (itemName === 'Alcohol') { newP.hp = Math.min(GAME_CONFIG.START_HP, newP.hp + 7); audioManager.playConfirm(); }
              else if (itemName === 'Sharpening Stone') { newP.activeBuffs = { ...newP.activeBuffs, damageBonus: 15 }; audioManager.playConfirm(); }
              else if (itemName === 'Painkillers') { newP.activeBuffs = { ...newP.activeBuffs, ignoreFatigue: true }; audioManager.playConfirm(); }
              return newP;
           }
           return p;
        });
        return { ...prev, players };
     });
  };

  // Pre-calculate the queue of events for the night
  const generateNightEvents = useCallback(() => {
    setState(prev => {
      const isVolcanoDay = prev.day === prev.volcanoDay;
      const isGasDay = prev.day === prev.gasDay;
      const isZoneShrinkDay = prev.day === 20 || prev.day === 30 || prev.day === 45; // Critical Zone Days
      // Monster day is random, but disabled on Zone Shrink days to prevent conflicting survival requirements
      const isMonsterDay = prev.day === prev.nextMonsterDay && !isZoneShrinkDay;
      
      const { exploreChance, zoneDmg } = getPhaseConfig(prev.day);

      // --- MASS RESOLUTION FOR VOLCANO ---
      if (isVolcanoDay) {
         const botActions = calculateBotActions(prev.players, true, false, false, false);
         const playersWithActions = prev.players.map(p => {
             let action = ActionType.NONE;
             if (p.id === prev.myPlayerId) action = pendingAction.type;
             else {
                 const bot = botActions.get(p.id);
                 if (bot) action = bot.type;
             }
             return { ...p, lastAction: action };
         });
         return { ...prev, phase: Phase.NIGHT, volcanoEventActive: true, players: playersWithActions, battleQueue: [], timeLeft: 0 };
      }

      // --- MASS RESOLUTION FOR GAS ---
      if (isGasDay) {
         const botActions = calculateBotActions(prev.players, false, true, false, false);
         const playersWithActions = prev.players.map(p => {
             let action = ActionType.NONE;
             if (p.id === prev.myPlayerId) action = pendingAction.type;
             else {
                 const bot = botActions.get(p.id);
                 if (bot) action = bot.type;
             }
             return { ...p, lastAction: action };
         });
         return { ...prev, phase: Phase.NIGHT, gasEventActive: true, players: playersWithActions, battleQueue: [], timeLeft: 0 };
      }

      // --- MASS RESOLUTION FOR MONSTER (HUNT PHASE) ---
      if (isMonsterDay) {
         const botActions = calculateBotActions(prev.players, false, false, false, true);
         const playersWithActions = prev.players.map(p => {
             let action = ActionType.NONE;
             if (p.id === prev.myPlayerId) action = pendingAction.type;
             else {
                 const bot = botActions.get(p.id);
                 if (bot) action = bot.type;
             }
             return { ...p, lastAction: action };
         });
         return { ...prev, phase: Phase.NIGHT, monsterEventActive: true, players: playersWithActions, battleQueue: [], timeLeft: 0 };
      }

      // --- STANDARD SEQUENTIAL RESOLUTION ---
      let players = JSON.parse(JSON.stringify(prev.players)) as Player[];
      const botActions = calculateBotActions(players, false, false, isZoneShrinkDay, false);
      const events: BattleEvent[] = [];
      const allActions: Array<{ playerId: string, type: ActionType, targetId: string | null }> = [];
      
      // 1. Assign Actions
      players.forEach(p => {
        if (p.status === PlayerStatus.DEAD) return;
        
        let action = ActionType.NONE;
        let targetId = null;

        if (p.id === prev.myPlayerId) {
             action = pendingAction.type;
             targetId = pendingAction.targetId || null;
        } else {
             const botAction = botActions.get(p.id);
             if (botAction) {
                 action = botAction.type;
                 targetId = botAction.targetId;
             }
        }
        
        // CRITICAL FIX: Explicitly set lastAction on the player object for the next day's cooldown logic
        p.lastAction = action;

        allActions.push({ playerId: p.id, type: action, targetId });
      });

      // 2. Resolve SHRINKING ZONE Failures (Immediate Death)
      if (isZoneShrinkDay) {
          allActions.forEach(act => {
              const p = players.find(x => x.id === act.playerId);
              if (!p) return;
              
              if (act.type !== ActionType.RUN) {
                  // Eliminate Player
                  p.status = PlayerStatus.DEAD;
                  p.hp = 0;
                  events.push({
                      id: Math.random().toString(),
                      type: 'DEATH', // Generic death event
                      sourceId: p.id,
                      description: 'A player was consumed by the shrinking zone.'
                  });
              }
          });
      }

      const aliveCount = players.filter(p => p.status === PlayerStatus.ALIVE).length;
      const damageMult = aliveCount <= GAME_CONFIG.CRITICAL_PLAYER_COUNT ? GAME_CONFIG.CRITICAL_DAMAGE_MULTIPLIER : 1;
      const runDisabled = aliveCount <= GAME_CONFIG.FINAL_DUEL_COUNT;
      const defendedPlayers = new Set<string>();
      const escapedPlayers = new Set<string>();

      allActions.forEach(act => {
        const p = players.find(x => x.id === act.playerId);
        if (!p || p.status === PlayerStatus.DEAD) return; // Skip if killed by zone

        let hCost = 0, fCost = 0;
        let damageBonus = p.activeBuffs.damageBonus || 0;

        switch (act.type) {
          case ActionType.ATTACK: hCost = GAME_CONFIG.COST_ATTACK_HUNGER; fCost = GAME_CONFIG.COST_ATTACK_FATIGUE; break;
          case ActionType.SHOOT: hCost = GAME_CONFIG.PISTOL_COST_HUNGER; fCost = GAME_CONFIG.PISTOL_COST_FATIGUE; break;
          case ActionType.DEFEND: hCost = GAME_CONFIG.COST_DEFEND_HUNGER; fCost = GAME_CONFIG.COST_DEFEND_FATIGUE; defendedPlayers.add(p.id); break;
          case ActionType.HEAL: fCost = GAME_CONFIG.COST_HEAL_FATIGUE; break;
          case ActionType.RUN: 
            hCost = GAME_CONFIG.COST_RUN_HUNGER; fCost = GAME_CONFIG.COST_RUN_FATIGUE; 
            if (runDisabled) { 
               hCost = GAME_CONFIG.COST_DEFEND_HUNGER; fCost = GAME_CONFIG.COST_DEFEND_FATIGUE;
               defendedPlayers.add(p.id);
               events.push({
                 id: Math.random().toString(), type: ActionType.DEFEND, sourceId: p.id,
                 description: `${p.name} tried to explore but was cornered!`
               });
            }
            break;
          case ActionType.EAT: p.hp = Math.min(GAME_CONFIG.START_HP, p.hp + GAME_CONFIG.EAT_HP_REGEN); break;
          case ActionType.REST: p.hp = Math.min(GAME_CONFIG.START_HP, p.hp + GAME_CONFIG.REST_HP_REGEN); break;
        }

        if (p.activeBuffs.ignoreFatigue) fCost = 0;
        p.hunger = Math.max(0, p.hunger - hCost);
        p.fatigue = Math.max(0, p.fatigue - fCost);
        (act as any).damageBonus = damageBonus;

        // --- STUN LOGIC CHECK ---
        if (p.status === PlayerStatus.ALIVE) {
             if (p.hunger <= 0 || p.fatigue <= 0) {
                 p.status = PlayerStatus.STUNNED;
                 events.push({
                     id: Math.random().toString(),
                     type: 'STUN',
                     sourceId: p.id,
                     description: `${p.name} collapsed from exhaustion!`
                 });
             }
        } else if (p.status === PlayerStatus.STUNNED) {
             if (p.hunger > 0 && p.fatigue > 0) {
                 p.status = PlayerStatus.ALIVE;
                 events.push({
                     id: Math.random().toString(),
                     type: 'STUN_RECOVERY',
                     sourceId: p.id,
                     description: `${p.name} recovered from exhaustion.`
                 });
             }
        }

        if (p.status === PlayerStatus.STUNNED && act.type !== ActionType.EAT && act.type !== ActionType.REST) return;

        if (act.type === ActionType.RUN && !runDisabled && p.status === PlayerStatus.ALIVE) {
             // DODGE/LOOT MECHANIC WITH STRICT DAY SCALING (NO FATIGUE)
             // This is a composite roll: Success = Dodge + Loot. Fail = Damage.
             // Success rates: Day 1-20 (80%), Day 21-29 (60%), Day 30+ (40%)
             
             if (Math.random() < exploreChance) {
               escapedPlayers.add(p.id);
               
               // Guaranteed Loot on Success (Composite Action)
               // Select item randomly
               const rIdx = Math.floor(Math.random() * ITEMS_LIST.length);
               const foundItemName = ITEMS_LIST[rIdx];
               const itemIdx = rIdx + 1;

               events.push({
                 id: Math.random().toString(), type: ActionType.RUN, sourceId: p.id, isMiss: false, value: itemIdx,
                 description: `${p.name} successfully explored and found ${foundItemName}.`
               });
             } else {
               // Fail - Take Damage
               events.push({
                 id: Math.random().toString(), type: ActionType.RUN, sourceId: p.id, isMiss: true, value: GAME_CONFIG.RUN_FAIL_DAMAGE,
                 description: `${p.name} tried to explore but stumbled and got hurt!`
               });
             }
        }
      });

      const combatActions = allActions.filter(a => [ActionType.ATTACK, ActionType.SHOOT, ActionType.EAT, ActionType.REST, ActionType.HEAL].includes(a.type));
      combatActions.sort(() => Math.random() - 0.5);

      combatActions.forEach(act => {
        const attacker = players.find(p => p.id === act.playerId);
        if (!attacker || attacker.status === PlayerStatus.DEAD) return;
        if (attacker.status === PlayerStatus.STUNNED && act.type !== ActionType.EAT && act.type !== ActionType.REST) return;

        if (act.type === ActionType.EAT) {
           events.push({ id: Math.random().toString(), type: ActionType.EAT, sourceId: attacker.id, value: GAME_CONFIG.EAT_REGEN, description: `${attacker.name} ate some rations.` });
        } else if (act.type === ActionType.REST) {
           events.push({ id: Math.random().toString(), type: ActionType.REST, sourceId: attacker.id, value: GAME_CONFIG.REST_REGEN, description: `${attacker.name} rested briefly.` });
        } else if (act.type === ActionType.HEAL && act.targetId) {
            const target = players.find(p => p.id === act.targetId);
            if (target && target.status === PlayerStatus.ALIVE) {
                events.push({ id: Math.random().toString(), type: ActionType.HEAL, sourceId: attacker.id, targetId: target.id, value: GAME_CONFIG.HEAL_AMOUNT, description: `${attacker.name} healed ${target.name} for ${GAME_CONFIG.HEAL_AMOUNT} HP.` });
            }
        } else if (act.type === ActionType.SHOOT && act.targetId) {
           const target = players.find(p => p.id === act.targetId);
           if (target && target.status !== PlayerStatus.DEAD) { // Can't shoot dead players from zone
              const extra = (act as any).damageBonus || 0;
              const pistolDmg = Math.floor(Math.random() * (GAME_CONFIG.PISTOL_DAMAGE_MAX - GAME_CONFIG.PISTOL_DAMAGE_MIN + 1)) + GAME_CONFIG.PISTOL_DAMAGE_MIN;
              const totalDmg = pistolDmg + extra + zoneDmg; // Add Zone Mod
              
              events.push({ 
                 id: Math.random().toString(), 
                 type: ActionType.SHOOT, 
                 sourceId: attacker.id, 
                 targetId: target.id, 
                 value: totalDmg, 
                 isBlocked: false, 
                 isMiss: false, 
                 description: `A player was shot.`
              });
           }
        } else if (act.type === ActionType.ATTACK && act.targetId) {
          const target = players.find(p => p.id === act.targetId);
          if (target) {
             if (target.status === PlayerStatus.DEAD) {
               events.push({ id: Math.random().toString(), type: ActionType.ATTACK, sourceId: attacker.id, targetId: target.id, isMiss: true, description: `${attacker.name} attacked ${target.name}'s corpse.` });
             } else if (escapedPlayers.has(target.id)) {
               events.push({ id: Math.random().toString(), type: ActionType.ATTACK, sourceId: attacker.id, targetId: target.id, isMiss: true, description: `${attacker.name} attacked ${target.name} but they dodged!` });
             } else {
               let rawDmg = Math.floor(Math.random() * (GAME_CONFIG.DAMAGE_MAX - GAME_CONFIG.DAMAGE_MIN + 1)) + GAME_CONFIG.DAMAGE_MIN;
               rawDmg *= damageMult;
               rawDmg += ((act as any).damageBonus || 0) + zoneDmg; // Add Zone Mod
               
               let isBlocked = false;
               if (defendedPlayers.has(target.id)) {
                 const reduction = 0.2 + (0.6 * (Math.max(0, Math.min(100, target.fatigue)) / 100));
                 rawDmg *= (1 - reduction);
                 isBlocked = true;
               }
               events.push({ id: Math.random().toString(), type: ActionType.ATTACK, sourceId: attacker.id, targetId: target.id, value: Math.floor(rawDmg), isBlocked, description: isBlocked ? `${target.name} blocked ${attacker.name}'s attack!` : `${attacker.name} hit ${target.name} for ${Math.floor(rawDmg)} damage.` });
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

  // IMPACT LOGIC (Damage, Healing, Logs) - Update Stats on Kill/Death
  useEffect(() => {
    if (!state.currentEvent) return;
    
    const event = state.currentEvent;
    
    // TIMING CONFIG - SPEED UP NON-COMBAT
    let impactDelay = 200; 
    let totalDuration = 700; // 0.7s for Eat, Rest, Heal, Run, Defend (FASTER)

    if (event.type === ActionType.ATTACK) {
        impactDelay = 700;
        totalDuration = 1400; // Slower for impact
    } else if (event.type === ActionType.SHOOT) {
        impactDelay = 400;
        totalDuration = 1000;
    } else if (event.type === 'DEATH') {
        impactDelay = 200;
        totalDuration = 1200; // Slower for drama
    }

    // IMPACT LOGIC
    const impactTimer = setTimeout(() => {
        setState(prev => {
             let updatedPlayers = prev.players.map(p => ({...p}));
             let logs = [...prev.logs];
             
             updatedPlayers = updatedPlayers.map(p => {
                let newP = { ...p };
                // SOURCE EFFECTS
                if (p.id === event.sourceId) {
                  if (event.type === ActionType.RUN) {
                      // Cooldown set in Day Reset logic below, handled next day
                  }
                  if ((event.type === ActionType.RUN && event.isMiss && event.value)) {
                      newP.hp = Math.max(0, newP.hp - (event.value || 0));
                  }
                  if (event.type === ActionType.EAT && event.value) {
                      newP.hunger = Math.min(100, newP.hunger + event.value);
                      newP.hp = Math.min(GAME_CONFIG.START_HP, newP.hp + GAME_CONFIG.EAT_HP_REGEN);
                      newP.cooldowns.eat = 2; 
                  } else if (event.type === ActionType.REST && event.value) {
                      newP.fatigue = Math.min(100, newP.fatigue + event.value);
                      newP.hp = Math.min(GAME_CONFIG.START_HP, newP.hp + GAME_CONFIG.REST_HP_REGEN);
                      newP.cooldowns.rest = 2;
                  }
                  // Handle Item Finding
                  if (event.type === ActionType.RUN && !event.isMiss && event.value && typeof event.value === 'number') {
                      if (event.value > 0) {
                        const itemName = ITEMS_LIST[event.value - 1];
                        if (itemName) newP.inventory.push(itemName);
                      }
                  }
                }
                // TARGET EFFECTS
                if (event.targetId === p.id) {
                  if (event.type === ActionType.ATTACK || event.type === ActionType.SHOOT) {
                    if (!event.isMiss && !event.isBlocked && event.value) newP.hp -= event.value;
                  } else if (event.type === ActionType.HEAL && event.value) {
                    newP.hp = Math.min(GAME_CONFIG.START_HP, newP.hp + event.value);
                  }
                }
                
                // KILL TRACKING
                if (newP.hp <= 0 && newP.status !== PlayerStatus.DEAD) {
                  newP.status = PlayerStatus.DEAD;
                  newP.hp = 0;
                  logs.push({ id: Date.now().toString() + Math.random(), text: `${newP.name} has died.`, type: 'death', day: prev.day, involvedIds: [newP.id] });
                  audioManager.playDeath();
                  
                  // Record stats if it's the player
                  if (newP.id === prev.myPlayerId && !gameRecordedRef.current) {
                      const me = prev.players.find(p => p.id === prev.myPlayerId);
                      storageService.updateStats({ died: true, killed: me?.kills || 0 });
                      gameRecordedRef.current = true;
                  }
                }
                return newP;
             });
             
             // Update Kills in State (for UI)
             if ((event.type === ActionType.ATTACK || event.type === ActionType.SHOOT) && event.sourceId && event.targetId) {
                const target = updatedPlayers.find(p => p.id === event.targetId);
                const source = updatedPlayers.find(p => p.id === event.sourceId);
                if (target?.status === PlayerStatus.DEAD && prev.players.find(p => p.id === target.id)?.status === PlayerStatus.ALIVE) {
                     if (source) {
                         source.kills += 1;
                         // If source is ME, update storage immediately
                         if (source.id === prev.myPlayerId) {
                             storageService.updateStats({ killed: 1 });
                         }
                     }
                }
             }

             const involvedIds = event.type === ActionType.SHOOT 
                ? [event.targetId].filter(Boolean) as string[] 
                : [event.sourceId, event.targetId].filter(Boolean) as string[];

             logs.push({ id: event.id, text: event.description, type: 'combat', day: prev.day, involvedIds });
             
             // SOUND EFFECTS
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

    // CLEANUP / NEXT EVENT TRIGGER
    const cleanupTimer = setTimeout(() => {
        setState(prev => ({ ...prev, currentEvent: null }));
    }, totalDuration);

    return () => {
        clearTimeout(impactTimer);
        clearTimeout(cleanupTimer);
    };
  }, [state.currentEvent]);
  
  // RECORD WIN
  useEffect(() => {
      if (state.phase === Phase.GAME_OVER && state.winnerId === state.myPlayerId && !gameRecordedRef.current) {
          storageService.updateStats({ won: true });
          gameRecordedRef.current = true;
      }
  }, [state.phase, state.winnerId, state.myPlayerId]);

  // --- GAME LOOP & ANIMATION ORCHESTRATION ---

  useEffect(() => {
    if (state.phase === Phase.DAY && state.timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
      }, 1000);
    } else if (state.phase === Phase.DAY && state.timeLeft === 0) {
      audioManager.playPhaseNight();
      generateNightEvents();
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.phase, state.timeLeft, generateNightEvents]);

  useEffect(() => {
    if (state.phase !== Phase.NIGHT) return;
    
    // If showing an event, wait before clearing
    if (state.currentEvent) {
      // Logic handled in impact/cleanup useEffect
      return;
    }

    // MASS EVENT TIMING CONTROL (NO SILENT RESOLVE)
    const isMassEvent = state.volcanoEventActive || state.gasEventActive || state.monsterEventActive;
    let delay = 1000;
    
    // Strict timings for animations
    if (state.gasEventActive) delay = 8000; // 8 Seconds for Gas
    else if (state.volcanoEventActive) delay = 5000; // 5 Seconds for Volcano
    else if (state.monsterEventActive) delay = 5000; // 5 Seconds for Monster

    // If events in queue, pop one
    if (state.battleQueue.length > 0) {
       // Reduced idle delay from 500 to 100 for faster flow
       const t = setTimeout(() => {
         setState(prev => {
            const [nextEvent, ...remaining] = prev.battleQueue;
            
            // Note: Audio triggers moved to impact logic or distinct step if needed right at start
            // STUN sound needs to be here if not in impact logic
            if (nextEvent.type === 'STUN') audioManager.playError();

            const newLog: LogEntry = {
              id: Date.now().toString() + Math.random(),
              text: nextEvent.description,
              type: nextEvent.type === 'DEATH' ? 'death' : 'combat',
              day: prev.day,
              involvedIds: [nextEvent.sourceId, nextEvent.targetId || ''].filter(Boolean)
            };

            return {
               ...prev,
               currentEvent: nextEvent,
               battleQueue: remaining,
               // Logs are added here for immediate feedback, or later in impact for sync?
               // Keeping existing pattern: Log added here for event start visibility
               logs: [...prev.logs] // Log addition moved to impact for sync in impact effect
            };
         });
       }, 100); // 100ms Interval between events
       return () => clearTimeout(t);
    } else {
       // Queue Empty -> End Night / Check Win
       const t = setTimeout(() => {
          setState(prev => {
             const alive = prev.players.filter(p => p.status === PlayerStatus.ALIVE);
             
             // CHECK WIN
             if (alive.length <= 1) {
                 return {
                    ...prev,
                    phase: Phase.GAME_OVER,
                    winnerId: alive.length === 1 ? alive[0].id : null,
                    logs: [...prev.logs, { id: 'gameover', text: 'MATCH ENDED.', type: 'system', day: prev.day }]
                 };
             }

             // NEXT DAY
             const nextDay = prev.day + 1;
             
             // PISTOL EVENT CHECK
             let pistolLogs: LogEntry[] = [];
             let updatedPlayers = prev.players.map(p => ({ ...p }));
             
             if (nextDay === prev.pistolDay) {
                 const livingPlayers = updatedPlayers.filter(p => p.status === PlayerStatus.ALIVE && !p.hasPistol);
                 if (livingPlayers.length > 0) {
                     const luckyIdx = Math.floor(Math.random() * livingPlayers.length);
                     const luckyId = livingPlayers[luckyIdx].id;
                     
                     updatedPlayers = updatedPlayers.map(p => {
                        if (p.id === luckyId) return { ...p, hasPistol: true };
                        return p;
                     });
                     
                     pistolLogs.push({
                         id: `pistol-${nextDay}`,
                         text: 'A hidden weapon has been smuggled into the arena...',
                         type: 'system',
                         day: nextDay
                     });
                     
                     audioManager.playConfirm();
                 }
             }

             // Update Cooldowns & Bots (Simple cleanup)
             const nextPlayers = updatedPlayers.map(p => {
                 let runCooldown = Math.max(0, p.cooldowns.run - 1);
                 
                 // If player ran today (during the night resolution we just finished), set cooldown to 1 for tomorrow
                 if (p.lastAction === ActionType.RUN) {
                    runCooldown = 1;
                 }

                 return {
                     ...p,
                     cooldowns: {
                        eat: Math.max(0, p.cooldowns.eat - 1),
                        rest: Math.max(0, p.cooldowns.rest - 1),
                        run: runCooldown,
                        shoot: Math.max(0, p.cooldowns.shoot - 1),
                        eatCount: p.cooldowns.eatCount,
                        restCount: p.cooldowns.restCount
                     }
                 };
             });

             audioManager.playPhaseDay();

             return {
                ...prev,
                phase: Phase.DAY,
                day: nextDay,
                timeLeft: getDayDuration(nextDay),
                players: nextPlayers,
                logs: [...prev.logs, ...pistolLogs, { id: `day${nextDay}`, text: `Day ${nextDay} Begins.`, type: 'system', day: nextDay }],
                volcanoEventActive: false,
                gasEventActive: false,
                monsterEventActive: false
             };
          });
          setPendingAction({ type: ActionType.NONE });
       }, delay); // DYNAMIC DELAY FOR MASS EVENTS
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
    pendingAction,
    sendChatMessage,
    closeModal
  };
};

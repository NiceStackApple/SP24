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
  if (day < 30) return 20; // Gameplay Adjust: Days 20-29 are 20s
  return 10;
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
    modal: { isOpen: false, title: '', message: '' },
    volcanoDay: -1,
    gasDay: -1,
    volcanoEventActive: false,
    gasEventActive: false,
    monsterEventActive: false,
    nextMonsterDay: GAME_CONFIG.MONSTER_START_DAY
  });

  const [pendingAction, setPendingAction] = useState<{ type: ActionType, targetId?: string | null }>({ type: ActionType.NONE });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
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

    // Randomize Volcano Day (10-15) and Gas Day (4-6)
    const volcanoDay = Math.floor(Math.random() * (GAME_CONFIG.VOLCANO_MAX_DAY - GAME_CONFIG.VOLCANO_MIN_DAY + 1)) + GAME_CONFIG.VOLCANO_MIN_DAY;
    const gasDay = Math.floor(Math.random() * (GAME_CONFIG.GAS_MAX_DAY - GAME_CONFIG.GAS_MIN_DAY + 1)) + GAME_CONFIG.GAS_MIN_DAY;
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
      else if (isMonsterDay) action = ActionType.DEFEND; // Hide from Monster
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

  // Pre-calculate the queue of events for the night
  const generateNightEvents = useCallback(() => {
    setState(prev => {
      const isVolcanoDay = prev.day === prev.volcanoDay;
      const isGasDay = prev.day === prev.gasDay;
      const isZoneShrinkDay = prev.day === 20 || prev.day === 30; // Hardcoded Shrink Days
      const isMonsterDay = prev.day === prev.nextMonsterDay;
      
      // Calculate Zone Damage Modifier based on Day
      let zoneDamageMod = 0;
      if (prev.day >= 30) zoneDamageMod = 10;
      else if (prev.day >= 20) zoneDamageMod = 5;

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

      // --- MASS RESOLUTION FOR MONSTER ---
      if (isMonsterDay) {
         const botActions = calculateBotActions(prev.players, false, false, isZoneShrinkDay, true);
         const playersWithActions = prev.players.map(p => {
             let action = ActionType.NONE;
             if (p.id === prev.myPlayerId) action = pendingAction.type;
             else {
                 const bot = botActions.get(p.id);
                 if (bot) action = bot.type;
             }
             return { ...p, lastAction: action };
         });
         // Monster resolution is treated as mass event visually first, BUT can stack with other combat?
         // The requirement says "Resolves Environmental first". 
         // Since Monster doesn't kill instantly (damage), we can treat it like Gas/Volcano mass event mode for the visual phase.
         return { ...prev, phase: Phase.NIGHT, monsterEventActive: true, players: playersWithActions, battleQueue: [], timeLeft: 0 };
      }

      // --- STANDARD SEQUENTIAL RESOLUTION (Includes Zone Logic) ---
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
                      description: 'A player was lost to the shrinking zone.'
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
             // If Zone Day, Run is just survival. Loot chance might be lower or standard.
             // Keeping standard for now.
             const itemChance = 0.5;
             let foundItemName = '';
             let itemIdx = 0;
             if (Math.random() < itemChance) {
                const rIdx = Math.floor(Math.random() * ITEMS_LIST.length);
                foundItemName = ITEMS_LIST[rIdx];
                itemIdx = rIdx + 1; 
             }

             if (Math.random() < GAME_CONFIG.RUN_SUCCESS_CHANCE) {
               escapedPlayers.add(p.id);
               events.push({
                 id: Math.random().toString(), type: ActionType.RUN, sourceId: p.id, isMiss: false, value: itemIdx,
                 description: foundItemName ? `${p.name} explored and found ${foundItemName}.` : `${p.name} explored the area.`
               });
             } else {
               events.push({
                 id: Math.random().toString(), type: ActionType.RUN, sourceId: p.id, isMiss: true, value: GAME_CONFIG.RUN_FAIL_DAMAGE,
                 description: `${p.name} tripped while exploring!`
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
              const totalDmg = pistolDmg + extra + zoneDamageMod; // Add Zone Mod
              
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
               events.push({ id: Math.random().toString(), type: ActionType.ATTACK, sourceId: attacker.id, targetId: target.id, isMiss: true, description: `${attacker.name} attacked ${target.name} but they were gone.` });
             } else {
               let rawDmg = Math.floor(Math.random() * (GAME_CONFIG.DAMAGE_MAX - GAME_CONFIG.DAMAGE_MIN + 1)) + GAME_CONFIG.DAMAGE_MIN;
               rawDmg *= damageMult;
               rawDmg += ((act as any).damageBonus || 0) + zoneDamageMod; // Add Zone Mod
               
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

  const sendChatMessage = useCallback((text: string, recipientId?: string) => {
    setState(prev => {
      const newMessage: ChatMessage = {
        id: Date.now().toString() + Math.random(),
        senderId: prev.myPlayerId || 'unknown',
        senderName: prev.players.find(p => p.id === prev.myPlayerId)?.name || 'Unknown',
        text,
        timestamp: Date.now(),
        isWhisper: !!recipientId,
        recipientId,
        recipientName: recipientId ? prev.players.find(p => p.id === recipientId)?.name : undefined
      };
      return { ...prev, messages: [...prev.messages, newMessage] };
    });
  }, []);

  // Timer Tick
  useEffect(() => {
    if (state.phase === Phase.LOBBY || state.phase === Phase.GAME_OVER) return;

    timerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.phase === Phase.DAY) {
          if (prev.timeLeft <= 0) return prev;
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        }
        return prev;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.phase]);

  // Phase Transition Trigger
  useEffect(() => {
    if (state.phase === Phase.DAY && state.timeLeft <= 0) {
      generateNightEvents();
    }
  }, [state.phase, state.timeLeft, generateNightEvents]);

  // --- 1. MASS EVENT RESOLVER (VOLCANO / GAS / MONSTER) ---
  useEffect(() => {
    if (state.phase !== Phase.NIGHT) return;
    
    // VOLCANO
    if (state.volcanoEventActive) {
        const timeout = setTimeout(() => {
            setState(prev => {
                const updatedPlayers = prev.players.map(p => {
                    if (p.status === PlayerStatus.DEAD) return p;
                    let newP = { ...p };
                    if (newP.lastAction === ActionType.RUN) {
                         newP.hunger = Math.max(0, newP.hunger - GAME_CONFIG.COST_RUN_HUNGER);
                         newP.fatigue = Math.max(0, newP.fatigue - GAME_CONFIG.COST_RUN_FATIGUE);
                         newP.cooldowns.run = 3;
                    } else {
                         newP.hp -= GAME_CONFIG.VOLCANO_DAMAGE;
                    }
                    if (newP.hp <= 0) newP.status = PlayerStatus.DEAD;
                    return newP;
                });
                // Logs
                let logs = [...prev.logs];
                updatedPlayers.forEach(p => {
                    if (p.status === PlayerStatus.DEAD && prev.players.find(old => old.id === p.id)?.status !== PlayerStatus.DEAD) {
                         logs.push({ id: Math.random().toString(), text: `${p.name} was consumed by the eruption.`, type: 'death', day: prev.day, involvedIds: [p.id] });
                    }
                });
                logs.push({ id: 'volcano-end', text: `The eruption subsides.`, type: 'system', day: prev.day });
                
                return { ...prev, volcanoEventActive: false, logs, players: updatedPlayers };
            });
        }, 10000);
        return () => clearTimeout(timeout);
    }
    
    // GAS
    if (state.gasEventActive) {
        const timeout = setTimeout(() => {
            setState(prev => {
                const updatedPlayers = prev.players.map(p => {
                    if (p.status === PlayerStatus.DEAD) return p;
                    let newP = { ...p };
                    if (newP.lastAction === ActionType.DEFEND) {
                         newP.hunger = Math.max(0, newP.hunger - GAME_CONFIG.COST_DEFEND_HUNGER);
                         newP.fatigue = Math.max(0, newP.fatigue - GAME_CONFIG.COST_DEFEND_FATIGUE);
                    } else {
                         newP.hp -= GAME_CONFIG.GAS_DAMAGE;
                    }
                    if (newP.hp <= 0) newP.status = PlayerStatus.DEAD;
                    return newP;
                });
                let logs = [...prev.logs];
                updatedPlayers.forEach(p => {
                    if (p.status === PlayerStatus.DEAD && prev.players.find(old => old.id === p.id)?.status !== PlayerStatus.DEAD) {
                         logs.push({ id: Math.random().toString(), text: `${p.name} succumbed to the toxic gas.`, type: 'death', day: prev.day, involvedIds: [p.id] });
                    }
                });
                logs.push({ id: 'gas-end', text: `The wind clears the poison gas.`, type: 'system', day: prev.day });
                return { ...prev, gasEventActive: false, logs, players: updatedPlayers };
            });
        }, 8000);
        return () => clearTimeout(timeout);
    }

    // MONSTER
    if (state.monsterEventActive) {
        const timeout = setTimeout(() => {
            setState(prev => {
                const updatedPlayers = prev.players.map(p => {
                    if (p.status === PlayerStatus.DEAD) return p;
                    let newP = { ...p };
                    if (newP.lastAction === ActionType.DEFEND) {
                         // Defend success: small cost but no damage
                         newP.hunger = Math.max(0, newP.hunger - GAME_CONFIG.COST_DEFEND_HUNGER);
                         newP.fatigue = Math.max(0, newP.fatigue - GAME_CONFIG.COST_DEFEND_FATIGUE);
                    } else {
                         // Fail: Take damage
                         newP.hp -= GAME_CONFIG.MONSTER_DAMAGE;
                    }
                    if (newP.hp <= 0) newP.status = PlayerStatus.DEAD;
                    return newP;
                });
                let logs = [...prev.logs];
                let monsterHit = false;
                updatedPlayers.forEach(p => {
                   if (p.hp < prev.players.find(old => old.id === p.id)?.hp!) monsterHit = true;
                   if (p.status === PlayerStatus.DEAD && prev.players.find(old => old.id === p.id)?.status !== PlayerStatus.DEAD) {
                        logs.push({ id: Math.random().toString(), text: `${p.name} was killed by a monster.`, type: 'death', day: prev.day, involvedIds: [p.id] });
                   }
                });
                if (monsterHit) logs.push({ id: 'monster-hit', text: 'A monster attacked during the night.', type: 'combat', day: prev.day });
                
                // Set next monster day (1-3 days later)
                const nextDay = prev.day + Math.floor(Math.random() * 3) + 1;
                
                return { ...prev, monsterEventActive: false, logs, players: updatedPlayers, nextMonsterDay: nextDay };
            });
        }, 8000); // 8 second animation
        return () => clearTimeout(timeout);
    }

  }, [state.phase, state.volcanoEventActive, state.gasEventActive, state.monsterEventActive]);

  // --- 2. QUEUE MANAGER (PULLER & DAY TRANSITION) ---
  useEffect(() => {
    if (state.phase !== Phase.NIGHT) return;
    // Block if mass event running or currently processing an event
    if (state.volcanoEventActive || state.gasEventActive || state.monsterEventActive || state.currentEvent) return;

    if (state.battleQueue.length > 0) {
        // PULL NEXT EVENT
        const nextEvent = state.battleQueue[0];
        const remaining = state.battleQueue.slice(1);
        setState(prev => ({ ...prev, currentEvent: nextEvent, battleQueue: remaining }));
    } else {
        // QUEUE EMPTY -> TRANSITION TO NEXT DAY
        const timeout = setTimeout(() => {
             setState(prev => {
                const playersReset = prev.players.map(p => ({
                    ...p,
                    activeBuffs: { damageBonus: 0, ignoreFatigue: false },
                    cooldowns: {
                      eat: Math.max(0, p.cooldowns.eat - 1),
                      rest: Math.max(0, p.cooldowns.rest - 1),
                      run: Math.max(0, p.cooldowns.run - 1), // Standard decrement
                      shoot: Math.max(0, p.cooldowns.shoot - 1),
                      eatCount: p.cooldowns.eatCount,
                      restCount: p.cooldowns.restCount
                    },
                    hunger: Math.max(0, Math.min(100, p.hunger + GAME_CONFIG.REGEN_HUNGER)),
                    fatigue: Math.max(0, Math.min(100, p.fatigue + GAME_CONFIG.REGEN_FATIGUE))
                }));
                
                // Gameplay Adjust: Reset Run cooldown to 1 instead of decrement if it was used last turn
                playersReset.forEach(p => {
                   if (p.lastAction === ActionType.RUN) {
                       p.cooldowns.run = 1; // Gameplay Adjustment: 1 Day cooldown for Explore
                   }
                });

                const alive = playersReset.filter(p => p.status === PlayerStatus.ALIVE);
                
                // Pistol Assignment Logic
                if (prev.day >= GAME_CONFIG.PISTOL_START_DAY && prev.day <= GAME_CONFIG.PISTOL_END_DAY) {
                   const hasPistol = playersReset.some(p => p.hasPistol);
                   if (!hasPistol && Math.random() < GAME_CONFIG.PISTOL_CHANCE) {
                      const idx = Math.floor(Math.random() * alive.length);
                      if (alive[idx]) alive[idx].hasPistol = true;
                   }
                }

                let phase = Phase.DAY;
                let winnerId = null;
                if (alive.length <= 1) {
                    phase = Phase.GAME_OVER;
                    winnerId = alive[0]?.id || null;
                }

                const nextDay = phase === Phase.DAY ? prev.day + 1 : prev.day;
                let modal = prev.modal;
                if (nextDay === prev.volcanoDay - 1) {
                    modal = { isOpen: true, title: 'WARNING: SEISMIC ACTIVITY', message: 'The ground trembles beneath your feet.\nThe ground will erupt. Only those who dodge or explore may survive.' };
                }
                if (nextDay === prev.gasDay - 1) {
                    modal = { isOpen: true, title: 'WARNING: TOXIC FUMES', message: 'A strange smell spreads in the air.\nPoison gas will be released tomorrow.\n\nSURVIVAL PROTOCOL:\nPlayers must DEFEND to filter the air.' };
                }
                // ZONE WARNINGS
                if (nextDay === 19 || nextDay === 29) {
                    modal = { 
                      isOpen: true, 
                      title: 'ZONE WARNING', 
                      message: 'The zone is shrinking. Stay away from the barrier.\n\nTOMORROW: You MUST choose EXPLORE (RUN) to survive.\nFailure to move will result in elimination.' 
                    };
                }
                // MONSTER WARNING (1 Day before)
                if (nextDay === prev.nextMonsterDay - 1 && nextDay >= 29) {
                     modal = { 
                      isOpen: true, 
                      title: 'DANGER', 
                      message: 'You feel something watching you from the dark.\n\nHIDE (DEFEND) tomorrow night to survive.' 
                    };
                }

                return {
                    ...prev,
                    phase,
                    day: nextDay,
                    timeLeft: getDayDuration(nextDay),
                    players: playersReset,
                    currentEvent: null,
                    winnerId,
                    modal
                };
             });
             setPendingAction({ type: ActionType.NONE });
        }, 500); // Brief pause before day start
        return () => clearTimeout(timeout);
    }
  }, [state.phase, state.battleQueue, state.currentEvent, state.volcanoEventActive, state.gasEventActive, state.monsterEventActive]);

  // --- 3. EVENT PROCESSOR (SHOTOUT EXECUTION) ---
  useEffect(() => {
    if (!state.currentEvent) return;

    const event = state.currentEvent;
    const isAttack = event.type === ActionType.ATTACK; // Standard attack with physical movement
    const isShoot = event.type === ActionType.SHOOT;
    
    // TIMING CONFIG
    let impactDelay = 250;
    let totalDuration = 900;

    if (isAttack) {
        impactDelay = 700;
        totalDuration = 1400;
    } else if (isShoot) {
        impactDelay = 400; // Fast impact
        totalDuration = 1000;
    }

    // IMPACT LOGIC (Damage, Healing, Logs)
    const impactTimer = setTimeout(() => {
        setState(prev => {
             let updatedPlayers = prev.players.map(p => ({...p}));
             let logs = [...prev.logs];
             
             updatedPlayers = updatedPlayers.map(p => {
                let newP = { ...p };
                // SOURCE EFFECTS
                if (p.id === event.sourceId) {
                  if (event.type === ActionType.RUN) {
                      // Cooldown set in Night Gen or Day Reset
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
                // DEATH CHECK
                if (newP.hp <= 0 && newP.status !== PlayerStatus.DEAD) {
                  newP.status = PlayerStatus.DEAD;
                  newP.hp = 0;
                  logs.push({ id: Date.now().toString() + Math.random(), text: `${newP.name} has died.`, type: 'death', day: prev.day, involvedIds: [newP.id] });
                  audioManager.playDeath();
                }
                return newP;
             });
             
             // UNTRACEABLE LOG FOR SHOOT (Visuals are traceable, Log is anonymous)
             const involvedIds = event.type === ActionType.SHOOT 
                ? [event.targetId].filter(Boolean) as string[] 
                : [event.sourceId, event.targetId].filter(Boolean) as string[];

             logs.push({ id: event.id, text: event.description, type: 'combat', day: prev.day, involvedIds });
             
             // SOUND EFFECTS
             if (event.type === ActionType.ATTACK) audioManager.playAttack();
             if (event.type === ActionType.SHOOT) audioManager.playAttack(); // Use sharp attack sound
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
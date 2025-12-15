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
import { GAME_CONFIG, NAMES_LIST } from '../constants';
import { audioManager } from '../services/audioService';

const generateBots = (count: number): Player[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `bot-${i}`,
    name: NAMES_LIST[i % NAMES_LIST.length] + `-${i + 1}`,
    isBot: true,
    avatarId: i + 1,
    hp: GAME_CONFIG.START_HP,
    hunger: GAME_CONFIG.START_HUNGER,
    fatigue: GAME_CONFIG.START_FATIGUE,
    status: PlayerStatus.ALIVE,
    cooldowns: { eat: 0, rest: 0, run: 0, eatCount: 0, restCount: 0 },
    lastAction: null,
    incomingAttacks: [],
    targetId: null,
    kills: 0
  }));
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
    currentEvent: null
  });

  const [pendingAction, setPendingAction] = useState<{ type: ActionType, targetId?: string | null }>({ type: ActionType.NONE });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Audio context resume helper
  useEffect(() => {
    const handleUserInteraction = () => {
      audioManager.ensureContext();
    };
    window.addEventListener('click', handleUserInteraction);
    return () => window.removeEventListener('click', handleUserInteraction);
  }, []);

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, { id: Date.now().toString() + Math.random(), text, type, day: prev.day }]
    }));
  }, []);

  const startGame = (playerName: string) => {
    audioManager.startAmbient();
    audioManager.playConfirm();

    const myPlayer: Player = {
      id: 'player-me',
      name: playerName || 'Player 1',
      isBot: false,
      avatarId: 99,
      hp: GAME_CONFIG.START_HP,
      hunger: GAME_CONFIG.START_HUNGER,
      fatigue: GAME_CONFIG.START_FATIGUE,
      status: PlayerStatus.ALIVE,
      cooldowns: { eat: 0, rest: 0, run: 0, eatCount: 0, restCount: 0 },
      lastAction: null,
      incomingAttacks: [],
      targetId: null,
      kills: 0
    };

    const bots = generateBots(GAME_CONFIG.MAX_PLAYERS - 1);
    
    setState({
      phase: Phase.DAY,
      day: 1,
      timeLeft: GAME_CONFIG.DAY_DURATION,
      players: [myPlayer, ...bots],
      logs: [{ id: 'start', text: `Welcome to the Arena, ${playerName}. Day 1 Begins.`, type: 'system', day: 1 }],
      messages: [],
      myPlayerId: myPlayer.id,
      winnerId: null,
      battleQueue: [],
      currentEvent: null
    });
  };

  const submitAction = (type: ActionType, targetId: string | null = null) => {
    if (state.phase !== Phase.DAY) return;
    const me = state.players.find(p => p.id === state.myPlayerId);
    if (!me || me.status === PlayerStatus.DEAD) return;

    if (me.status === PlayerStatus.STUNNED) {
      audioManager.playError();
      return;
    }

    if (type === ActionType.RUN && me.cooldowns.run > 0) {
      audioManager.playError();
      return;
    }
    if (type === ActionType.EAT && me.cooldowns.eat > 0) {
      audioManager.playError();
      return;
    }
    if (type === ActionType.REST && me.cooldowns.rest > 0) {
      audioManager.playError();
      return;
    }

    setPendingAction({ type, targetId });
    audioManager.playClick();
  };

  // Bot Logic
  const calculateBotActions = (currentPlayers: Player[]) => {
    const botActions: Map<string, { type: ActionType, targetId: string | null }> = new Map();
    const alivePlayers = currentPlayers.filter(p => p.status === PlayerStatus.ALIVE);

    alivePlayers.forEach(bot => {
      if (!bot.isBot) return;
      
      let action = ActionType.NONE;
      let target: string | null = null;

      const lowHunger = bot.hunger < 40;
      const lowFatigue = bot.fatigue < 40;
      const lowHp = bot.hp < 50;
      
      if (lowHunger && bot.cooldowns.eat === 0) {
        action = ActionType.EAT;
      } else if (lowFatigue && bot.cooldowns.rest === 0) {
        action = ActionType.REST;
      } else if (lowHp) {
        action = ActionType.DEFEND;
      } else {
        const enemies = alivePlayers.filter(p => p.id !== bot.id);
        if (enemies.length > 0) {
          action = ActionType.ATTACK;
          target = enemies[Math.floor(Math.random() * enemies.length)].id;
        } else {
          action = ActionType.DEFEND;
        }
      }
      
      botActions.set(bot.id, { type: action, targetId: target });
    });
    return botActions;
  };

  // --- NIGHT EVENT GENERATION ---
  const generateNightEvents = useCallback(() => {
    setState(prev => {
      // 1. Snapshot players
      let players = JSON.parse(JSON.stringify(prev.players)) as Player[];
      const botActions = calculateBotActions(players);
      const events: BattleEvent[] = [];

      // 2. Consolidate Actions
      const allActions: Array<{ playerId: string, type: ActionType, targetId: string | null }> = [];
      
      players.forEach(p => {
        if (p.status === PlayerStatus.DEAD) return;
        if (p.status === PlayerStatus.STUNNED) {
           return;
        }

        if (p.id === prev.myPlayerId) {
          allActions.push({ playerId: p.id, type: pendingAction.type, targetId: pendingAction.targetId });
        } else {
          const botAction = botActions.get(p.id) || { type: ActionType.NONE, targetId: null };
          allActions.push({ playerId: p.id, ...botAction });
        }
      });

      // 3. Determine Modifiers & Costs
      const aliveCount = players.filter(p => p.status === PlayerStatus.ALIVE).length;
      const damageMult = aliveCount <= GAME_CONFIG.CRITICAL_PLAYER_COUNT ? GAME_CONFIG.CRITICAL_DAMAGE_MULTIPLIER : 1;
      const runDisabled = aliveCount <= GAME_CONFIG.FINAL_DUEL_COUNT;

      const defendedPlayers = new Set<string>();
      const escapedPlayers = new Set<string>();

      // Apply Costs immediately to snapshot (so we know if they starve later)
      // Also determine Stance (Defend/Run)
      allActions.forEach(act => {
        const p = players.find(x => x.id === act.playerId);
        if (!p) return;

        let hCost = 0, fCost = 0;

        switch (act.type) {
          case ActionType.ATTACK: hCost = GAME_CONFIG.COST_ATTACK_HUNGER; fCost = GAME_CONFIG.COST_ATTACK_FATIGUE; break;
          case ActionType.DEFEND: 
            hCost = GAME_CONFIG.COST_DEFEND_HUNGER; fCost = GAME_CONFIG.COST_DEFEND_FATIGUE; 
            defendedPlayers.add(p.id);
            break;
          case ActionType.RUN:
            if (runDisabled) {
               // Fallback to Defend
               hCost = GAME_CONFIG.COST_DEFEND_HUNGER; fCost = GAME_CONFIG.COST_DEFEND_FATIGUE;
               defendedPlayers.add(p.id);
               events.push({
                 id: Math.random().toString(), type: ActionType.DEFEND, sourceId: p.id,
                 description: `${p.name} tried to run but was cornered!`
               });
            } else {
               hCost = GAME_CONFIG.COST_RUN_HUNGER; fCost = GAME_CONFIG.COST_RUN_FATIGUE;
               if (Math.random() < GAME_CONFIG.RUN_SUCCESS_CHANCE) {
                 escapedPlayers.add(p.id);
                 events.push({
                   id: Math.random().toString(), type: ActionType.RUN, sourceId: p.id, isMiss: false,
                   description: `${p.name} moved into the shadows.`
                 });
               } else {
                 events.push({
                   id: Math.random().toString(), type: ActionType.RUN, sourceId: p.id, isMiss: true, value: GAME_CONFIG.RUN_FAIL_DAMAGE,
                   description: `${p.name} tripped while fleeing!`
                 });
               }
            }
            break;
        }
      });

      // Shuffle combat actions
      const combatActions = allActions.filter(a => a.type === ActionType.ATTACK || a.type === ActionType.EAT || a.type === ActionType.REST);
      combatActions.sort(() => Math.random() - 0.5);

      combatActions.forEach(act => {
        const attacker = players.find(p => p.id === act.playerId);
        if (!attacker || attacker.status !== PlayerStatus.ALIVE) return;

        if (act.type === ActionType.EAT) {
           events.push({ 
             id: Math.random().toString(), type: ActionType.EAT, sourceId: attacker.id, value: GAME_CONFIG.EAT_REGEN,
             description: `${attacker.name} ate some rations.` 
           });
        } else if (act.type === ActionType.REST) {
           events.push({ 
             id: Math.random().toString(), type: ActionType.REST, sourceId: attacker.id, value: GAME_CONFIG.REST_REGEN,
             description: `${attacker.name} rested briefly.` 
           });
        } else if (act.type === ActionType.ATTACK && act.targetId) {
          const target = players.find(p => p.id === act.targetId);
          if (target) {
             if (target.status === PlayerStatus.DEAD) {
               events.push({ 
                 id: Math.random().toString(), type: ActionType.ATTACK, sourceId: attacker.id, targetId: target.id, isMiss: true,
                 description: `${attacker.name} attacked ${target.name}'s corpse.` 
               });
             } else if (escapedPlayers.has(target.id)) {
               events.push({ 
                 id: Math.random().toString(), type: ActionType.ATTACK, sourceId: attacker.id, targetId: target.id, isMiss: true,
                 description: `${attacker.name} attacked ${target.name} but missed!` 
               });
             } else {
               // Calc damage
               let rawDmg = Math.floor(Math.random() * (GAME_CONFIG.DAMAGE_MAX - GAME_CONFIG.DAMAGE_MIN + 1)) + GAME_CONFIG.DAMAGE_MIN;
               rawDmg *= damageMult;
               let isBlocked = false;

               if (defendedPlayers.has(target.id)) {
                 const reduction = 0.2 + (0.6 * (Math.max(0, Math.min(100, target.fatigue)) / 100));
                 rawDmg *= (1 - reduction);
                 isBlocked = true;
               }

               events.push({ 
                 id: Math.random().toString(), type: ActionType.ATTACK, sourceId: attacker.id, targetId: target.id,
                 value: Math.floor(rawDmg), isBlocked,
                 description: isBlocked 
                   ? `${target.name} blocked ${attacker.name}'s attack!` 
                   : `${attacker.name} hit ${target.name} for ${Math.floor(rawDmg)} damage.`
               });
             }
          }
        }
      });

      return {
        ...prev,
        phase: Phase.NIGHT,
        battleQueue: events,
        currentEvent: null,
        timeLeft: 0 // Timer irrelevant during playback
      };
    });
  }, [pendingAction]);

  // --- PLAYBACK LOOP ---
  useEffect(() => {
    if (state.phase !== Phase.NIGHT) return;

    if (state.battleQueue.length === 0 && !state.currentEvent) {
      // Night Over - Finalize
      setTimeout(() => finalizeNight(), 1000);
      return;
    }

    if (!state.currentEvent && state.battleQueue.length > 0) {
      const nextEvent = state.battleQueue[0];
      const remainingQueue = state.battleQueue.slice(1);

      // 1. Start Event (Pre-highlight)
      setState(prev => ({ ...prev, currentEvent: nextEvent, battleQueue: remainingQueue }));

      // 2. Schedule Damage Application (Impact + Reveal time ~600ms)
      setTimeout(() => {
        applyEventToState(nextEvent);
      }, 600);

      // 3. Cleanup Event (After Exit + Pause)
      setTimeout(() => {
        setState(prev => ({ ...prev, currentEvent: null }));
      }, 1400); 
    }
  }, [state.phase, state.battleQueue, state.currentEvent]);

  const applyEventToState = (event: BattleEvent) => {
    setState(prev => {
      let newPlayers = [...prev.players];
      const pIndex = newPlayers.findIndex(p => p.id === event.sourceId);
      const tIndex = event.targetId ? newPlayers.findIndex(p => p.id === event.targetId) : -1;
      
      const newLogs: LogEntry[] = [];

      // Costs & Effects
      if (pIndex !== -1) {
        const p = newPlayers[pIndex];
        let hCost = 0, fCost = 0;
        
        switch (event.type) {
           case ActionType.ATTACK: hCost = GAME_CONFIG.COST_ATTACK_HUNGER; fCost = GAME_CONFIG.COST_ATTACK_FATIGUE; break;
           case ActionType.DEFEND: hCost = GAME_CONFIG.COST_DEFEND_HUNGER; fCost = GAME_CONFIG.COST_DEFEND_FATIGUE; break;
           case ActionType.RUN: hCost = GAME_CONFIG.COST_RUN_HUNGER; fCost = GAME_CONFIG.COST_RUN_FATIGUE; break;
        }

        p.hunger -= hCost;
        p.fatigue -= fCost;
        
        if (event.type === ActionType.EAT) {
           p.hunger += (event.value || 0);
           p.hp += GAME_CONFIG.EAT_HP_REGEN; // Add HP
        }
        if (event.type === ActionType.REST) {
           p.fatigue += (event.value || 0);
           p.hp += GAME_CONFIG.REST_HP_REGEN; // Add HP
        }
        if (event.type === ActionType.RUN && event.isMiss && event.value) p.hp -= event.value; // Trip damage
        
        // Cap stats
        p.hp = Math.min(p.hp, GAME_CONFIG.START_HP);
        p.hunger = Math.min(p.hunger, GAME_CONFIG.START_HUNGER);
        p.fatigue = Math.min(p.fatigue, GAME_CONFIG.START_FATIGUE);

        // Audio
        if (event.type === ActionType.ATTACK) {
           if (event.sourceId === prev.myPlayerId) audioManager.playAttack();
           if (!event.isMiss && !event.isBlocked && event.targetId === prev.myPlayerId) audioManager.playError(); // Get hit
           if (event.isBlocked) audioManager.playDefend();
        } else if (event.type === ActionType.RUN && !event.isMiss) {
           audioManager.playRun();
        } else if (event.type === ActionType.EAT && event.sourceId === prev.myPlayerId) {
           audioManager.playEat();
        } else if (event.type === ActionType.REST && event.sourceId === prev.myPlayerId) {
           audioManager.playRest();
        }
      }

      if (tIndex !== -1 && event.value && event.type === ActionType.ATTACK && !event.isMiss) {
        const t = newPlayers[tIndex];
        t.hp -= event.value;
        if (t.hp <= 0) {
           t.hp = 0;
           t.status = PlayerStatus.DEAD;
           newLogs.push({ id: Math.random().toString(), text: `${t.name} was killed by ${newPlayers[pIndex].name}!`, type: 'death', day: prev.day });
           audioManager.playDeath();
        }
      }

      // Add log
      newLogs.push({ id: event.id, text: event.description, type: event.type === ActionType.ATTACK ? 'combat' : 'info', day: prev.day });

      return {
        ...prev,
        players: newPlayers,
        logs: [...prev.logs, ...newLogs]
      };
    });
  };

  const finalizeNight = () => {
    setState(prev => {
      // Apply passive regen, stun checks, hunger checks
      let players = prev.players.map(p => {
         if (p.status === PlayerStatus.DEAD) return p;
         
         // Cooldowns
         let cds = { ...p.cooldowns };
         if (cds.eat > 0 && p.lastAction !== ActionType.EAT) cds.eat--;
         if (cds.rest > 0 && p.lastAction !== ActionType.REST) cds.rest--;
         if (cds.run > 0) cds.run--;
         
         // Regen
         let h = p.hunger + GAME_CONFIG.REGEN_HUNGER;
         let f = p.fatigue + GAME_CONFIG.REGEN_FATIGUE;

         // Check Stun
         let s = p.status;
         if (h < 0 || f < 0) s = PlayerStatus.STUNNED;
         else if (s === PlayerStatus.STUNNED) s = PlayerStatus.ALIVE;
         
         // Cap
         h = Math.min(h, GAME_CONFIG.START_HUNGER);
         f = Math.min(f, GAME_CONFIG.START_FATIGUE);

         return { ...p, hunger: h, fatigue: f, status: s, cooldowns: cds, incomingAttacks: [], targetId: null, lastAction: null };
      });

      const survivors = players.filter(p => p.status !== PlayerStatus.DEAD);
      let winnerId = null;
      let nextPhase = Phase.DAY;
      
      if (survivors.length <= 1) {
        nextPhase = Phase.GAME_OVER;
        winnerId = survivors.length === 1 ? survivors[0].id : null;
        audioManager.stopAmbient();
        if (winnerId) audioManager.playConfirm();
        else audioManager.playDeath();
      } else {
        audioManager.playPhaseDay();
      }

      return {
        ...prev,
        players,
        phase: nextPhase,
        day: nextPhase === Phase.DAY ? prev.day + 1 : prev.day,
        timeLeft: GAME_CONFIG.DAY_DURATION,
        winnerId
      };
    });
    setPendingAction({ type: ActionType.NONE });
  };

  // Timer Loop (Only for Day)
  useEffect(() => {
    if (state.phase !== Phase.DAY) return;

    timerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.timeLeft <= 1) {
          audioManager.playPhaseNight();
          // Trigger generation immediately
          setTimeout(() => generateNightEvents(), 0);
          return { ...prev, timeLeft: 0 };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.phase, generateNightEvents]);

  const sendChatMessage = (text: string, recipientId?: string) => {
    const me = state.players.find(p => p.id === state.myPlayerId);
    if (!me || me.status === PlayerStatus.DEAD) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: me.id,
      senderName: me.name,
      text,
      timestamp: Date.now(),
      isWhisper: !!recipientId,
      recipientId
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
    pendingAction,
    sendChatMessage
  };
};
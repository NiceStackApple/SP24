export enum Phase {
  LOBBY = 'LOBBY',
  DAY = 'DAY',
  NIGHT = 'NIGHT',
  GAME_OVER = 'GAME_OVER'
}

export enum ActionType {
  ATTACK = 'ATTACK',
  SHOOT = 'SHOOT',
  DEFEND = 'DEFEND',
  RUN = 'RUN',
  EAT = 'EAT',
  REST = 'REST',
  HEAL = 'HEAL',
  NONE = 'NONE'
}

export enum PlayerStatus {
  ALIVE = 'ALIVE',
  DEAD = 'DEAD',
  STUNNED = 'STUNNED'
}

export interface Cooldowns {
  eat: number;
  rest: number;
  run: number;
  shoot: number;
  eatCount: number;
  restCount: number;
}

export interface PlayerBuffs {
  damageBonus: number;
  ignoreFatigue: boolean;
}

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  avatarId: number;
  hp: number;
  hunger: number;
  fatigue: number;
  status: PlayerStatus;
  cooldowns: Cooldowns;
  lastAction: ActionType | null;
  incomingAttacks: string[]; // IDs of players attacking this player
  targetId: string | null; // ID of player this player is targeting
  kills: number;
  hasPistol: boolean;
  inventory: string[];
  activeBuffs: PlayerBuffs;
}

export interface LogEntry {
  id: string;
  text: string;
  type: 'info' | 'combat' | 'death' | 'system';
  day: number;
  involvedIds?: string[]; // IDs of players involved in this log for highlighting
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isWhisper?: boolean;
  recipientId?: string;
  recipientName?: string;
}

export interface BattleEvent {
  id: string;
  type: ActionType | 'DEATH' | 'STUN_RECOVERY' | 'STUN' | 'VOLCANO' | 'POISON' | 'MONSTER';
  sourceId: string;
  targetId?: string;
  value?: number; // Damage or Heal amount
  description: string;
  isCrit?: boolean;
  isMiss?: boolean;
  isBlocked?: boolean;
}

export interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
}

export interface GameState {
  phase: Phase;
  day: number;
  timeLeft: number; // Seconds
  players: Player[];
  logs: LogEntry[];
  messages: ChatMessage[];
  myPlayerId: string | null;
  winnerId: string | null;
  // Playback State
  battleQueue: BattleEvent[];
  currentEvent: BattleEvent | null;
  // Room Info
  roomCode: string | null;
  isHost: boolean;
  // UI State
  modal: ModalState;
  volcanoDay: number; // Day the eruption occurs
  gasDay: number; // Day the poison gas occurs
  volcanoEventActive?: boolean;
  gasEventActive?: boolean;
  
  // Monster Event
  nextMonsterDay: number;
  monsterEventActive?: boolean;
}

export interface ActionPayload {
  type: ActionType;
  targetId?: string | null;
}
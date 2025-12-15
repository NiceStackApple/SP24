export enum Phase {
  LOBBY = 'LOBBY',
  DAY = 'DAY',
  NIGHT = 'NIGHT',
  GAME_OVER = 'GAME_OVER'
}

export enum ActionType {
  ATTACK = 'ATTACK',
  DEFEND = 'DEFEND',
  RUN = 'RUN',
  EAT = 'EAT',
  REST = 'REST',
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
  eatCount: number;
  restCount: number;
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
}

export interface LogEntry {
  id: string;
  text: string;
  type: 'info' | 'combat' | 'death' | 'system';
  day: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isWhisper?: boolean;
  recipientId?: string;
}

export interface BattleEvent {
  id: string;
  type: ActionType | 'DEATH' | 'STUN_RECOVERY' | 'STUN';
  sourceId: string;
  targetId?: string;
  value?: number; // Damage or Heal amount
  description: string;
  isCrit?: boolean;
  isMiss?: boolean;
  isBlocked?: boolean;
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
}

export interface ActionPayload {
  type: ActionType;
  targetId?: string | null;
}
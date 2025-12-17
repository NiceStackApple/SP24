
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

// --- FIRESTORE SCHEMA TYPES ---

export interface UserStats {
  total_matches: number;
  wins: number;
  kills: number;
  days_survived: number;
}

export interface UserDocument {
  username: string;
  security_question: string;
  security_answer: string;
  created_at: any; // Timestamp
  active_session_id: string | null;
  stats: UserStats;
}

export interface FirestorePlayer {
  is_bot: boolean;
  connection_status: 'CONNECTED' | 'DISCONNECTED';
  last_active: number; // Timestamp for heartbeat/timeout
  hp: number;
  hunger: number;
  fatigue: number;
  inventory: string[];
  pending_action: {
    type: string;
    target: string | null;
  };
  // NEW: Authoritative State Fields
  status: PlayerStatus;
  cooldowns: Cooldowns;
  active_buffs: PlayerBuffs;
  last_explore_day: number;
  kills: number;
  has_pistol: boolean;
  avatar_id: number; // Visual identity
  
  // Helper, usually doc ID
  username?: string; 
}

export interface RoomDocument {
  room_name?: string; // Display name for browser
  host_username: string;
  is_public: boolean;
  player_count: number; // Optimization for Lobby listing
  status: 'LOBBY' | 'IN_PROGRESS' | 'RESOLVING' | 'ENDED';
  current_day: number;
  phase: 'DAY' | 'NIGHT';
  next_phase_time: any; // Timestamp
  events: string[];
}

// --- EXISTING UI TYPES (Maintained for GameEngine compatibility) ---

export interface UserProfile {
  name: string;
  avatarId: number;
  matchesPlayed: number;
  wins: number;
  kills: number;
  deaths: number;
}

export interface Account {
  username: string;
  passwordHash: string;
  secondPasswordHash: string; 
  profile: UserProfile;
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
  incomingAttacks: string[]; 
  targetId: string | null; 
  kills: number;
  hasPistol: boolean;
  inventory: string[];
  activeBuffs: PlayerBuffs;
  // UI Helper
  lastExploreDay?: number;
  pendingActionType?: ActionType; // Helper for UI
  connection_status?: 'CONNECTED' | 'DISCONNECTED';
}

export type LogType = 'system' | 'damage' | 'defense' | 'heal' | 'rest' | 'eat' | 'death' | 'item';

export interface LogEntry {
  id: string;
  text: string;
  type: LogType;
  day: number;
  involvedIds?: string[];
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
  type: ActionType | 'DEATH' | 'STUN_RECOVERY' | 'STUN' | 'VOLCANO' | 'POISON' | 'MONSTER' | 'ZONE_COLLAPSE';
  sourceId: string;
  targetId?: string;
  value?: number; 
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
  timeLeft: number;
  players: Player[];
  logs: LogEntry[];
  messages: ChatMessage[];
  myPlayerId: string | null;
  winnerId: string | null;
  battleQueue: BattleEvent[];
  currentEvent: BattleEvent | null;
  roomCode: string | null;
  isHost: boolean;
  isPractice: boolean; // NEW FLAG
  modal: ModalState;
  
  volcanoDay: number; 
  gasDay: number; 
  pistolDay: number; 
  
  volcanoEventActive?: boolean;
  gasEventActive?: boolean;
  zoneShrinkActive?: boolean;
  
  nextMonsterDay: number;
  monsterEventActive?: boolean;
  
  // WARNING STATE
  activeWarning?: { title: string; subtitle: string; theme: 'VOLCANO' | 'ACID' | 'ZONE' | 'MONSTER' } | null;

  // PRACTICE ADMIN FLAGS
  adminNoCost?: boolean;
  forceEventType?: 'VOLCANO' | 'GAS' | 'MONSTER' | 'SHRINK' | 'PISTOL' | null;
}

export interface ActionPayload {
  type: ActionType;
  targetId?: string | null;
}

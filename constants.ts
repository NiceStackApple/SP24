export const GAME_CONFIG = {
  MAX_PLAYERS: 24,
  // Duration Scaling handled in helper function
  DAY_DURATION_BASE: 35, 
  
  NIGHT_DURATION: 0, // Dynamic based on events
  START_HP: 200,
  START_HUNGER: 100,
  START_FATIGUE: 100,
  
  REGEN_HUNGER: 5,
  REGEN_FATIGUE: 5,
  
  COST_ATTACK_HUNGER: 30,
  COST_ATTACK_FATIGUE: 30,
  DAMAGE_MIN: 30,
  DAMAGE_MAX: 40,
  
  COST_DEFEND_HUNGER: 15,
  COST_DEFEND_FATIGUE: 10,
  
  COST_RUN_HUNGER: 20,
  COST_RUN_FATIGUE: 30,
  RUN_SUCCESS_CHANCE: 0.8,
  RUN_FAIL_DAMAGE: 10,
  
  EAT_REGEN: 30, 
  EAT_HP_REGEN: 5,
  REST_REGEN: 30, 
  REST_HP_REGEN: 5,
  
  COST_HEAL_FATIGUE: 20,
  HEAL_AMOUNT: 25,

  // Pistol Event Config
  PISTOL_START_DAY: 7,
  PISTOL_END_DAY: 15,
  PISTOL_CHANCE: 0.3, // 30% chance per day during window if not assigned
  PISTOL_DAMAGE_MIN: 80,
  PISTOL_DAMAGE_MAX: 100,
  PISTOL_COST_HUNGER: 30,
  PISTOL_COST_FATIGUE: 30,
  PISTOL_COOLDOWN: 0, // No cooldown
  
  CRITICAL_PLAYER_COUNT: 5,
  CRITICAL_DAMAGE_MULTIPLIER: 1.2,
  FINAL_DUEL_COUNT: 2,

  // World Events
  VOLCANO_DAMAGE: 45,
  VOLCANO_MIN_DAY: 10,
  VOLCANO_MAX_DAY: 15,

  GAS_DAMAGE: 35,
  GAS_MIN_DAY: 4,
  GAS_MAX_DAY: 6,

  // Monster Event
  MONSTER_START_DAY: 30,
  MONSTER_DAMAGE: 45,
};

export const NAMES_LIST = [
  "Clove", "Thresh", "Glimmer", "Marvel", "Cato", "Foxface", "Rue", "Gloss", "Cashmere", "Brutus", "Enobaria", "Beetee", "Wiress", "Finnick", "Mags", "Johanna", "Chaff", "Seeder", "Peeta", "Gale", "Haymitch", "Effie", "Cinna", "Caesar", "Snow", "Coin", "Prim", "Boggs", "Cressida", "Messalla", "Castor", "Pollux", "Annie", "Plutarch", "Lydia", "Marcus", "Valerius", "Octavia", "Flavius", "Venia", "Atala", "Seneca", "Claudius", "Tigris", "Portia", "Aurelius", "Gaius", "Lucius", "Felix"
];

export const ITEMS_LIST = [
  "Bread", "Canned Food", "Sharpening Stone", "Bandage", "Alcohol", "Painkillers"
];

export const ITEM_DESCRIPTIONS: Record<string, string> = {
  "Bread": "A simple meal. Restores +10 Hunger.",
  "Canned Food": "Preserved nutrients. Restores +15 Hunger.",
  "Sharpening Stone": "Adds +15 Damage to your next attack. Consumed on use.",
  "Bandage": "Basic medical supply. Restores +10 HP.",
  "Alcohol": "Strong disinfectant. Restores +7 HP.",
  "Painkillers": "Nulls fatigue cost for the next action."
};
export const GAME_CONFIG = {
  MAX_PLAYERS: 24,
  DAY_DURATION: 35,
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
  
  EAT_REGEN: 25,
  EAT_HP_REGEN: 5,
  REST_REGEN: 25,
  REST_HP_REGEN: 5,
  
  CRITICAL_PLAYER_COUNT: 5,
  CRITICAL_DAMAGE_MULTIPLIER: 1.2,
  FINAL_DUEL_COUNT: 2,
};

export const NAMES_LIST = [
  "Clove", "Thresh", "Glimmer", "Marvel", "Cato", "Foxface", "Rue", "Gloss", "Cashmere", "Brutus", "Enobaria", "Beetee", "Wiress", "Finnick", "Mags", "Johanna", "Chaff", "Seeder", "Peeta", "Gale", "Haymitch", "Effie", "Cinna", "Caesar", "Snow", "Coin", "Prim", "Boggs", "Cressida", "Messalla", "Castor", "Pollux", "Annie", "Plutarch", "Lydia", "Marcus", "Valerius", "Octavia", "Flavius", "Venia", "Atala", "Seneca", "Claudius", "Tigris", "Portia", "Aurelius", "Gaius", "Lucius", "Felix"
];
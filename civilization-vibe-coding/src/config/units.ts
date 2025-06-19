import { UnitId, TerrainId } from '../models/types';

export interface UnitDefinition extends UnitInfo {
  id: UnitId;
  /** Letter to use when rendering this unit on the map */
  letter: string;
  /** Relative path to the unit icon in public folder */
  image: string;
  spawnChance: Partial<Record<TerrainId, number>>;
}
function build(info: UnitInfo): UnitDefinition {
  const r: UnitDefinition = {
    ...info,
    id: info.name,
    name: info.name,
    letter: info.name.substring(0, 1),
    image: `/icons/units/${info.name}.svg`,
    spawnChance: { plains: 0.4, grassland: 0.4, desert: 0.4, tundra: 0.4, snow: 0.4 },
  };
  return r;
}
interface UnitInfo {
  name: string;
  type: string;
  moves: number;
  health: number;
  description: string;
}
const info = [
  {
    name: 'Warrior',
    type: 'melee',
    moves: 2,
    health: 10,
    description: 'Early-game infantry unit for exploration and basic defense.',
  },
  {
    name: 'Axeman',
    type: 'melee',
    moves: 2,
    health: 10,
    description: 'Stronger melee unit with bonus against melee; mid–Ancient era.',
  },
  {
    name: 'Spearman',
    type: 'melee',
    moves: 2,
    health: 10,
    description: 'Anti-cavalry melee unit with bonus vs mounted.',
  },
  {
    name: 'Maceman',
    type: 'melee',
    moves: 2,
    health: 10,
    description: 'Upgraded melee unit; stronger than Spearman.',
  },
  {
    name: 'Swordsman',
    type: 'melee',
    moves: 2,
    health: 10,
    description: 'Powerful melee unit unlocked with Iron Working.',
  },
  {
    name: 'Pikeman',
    type: 'melee',
    moves: 2,
    health: 10,
    description: 'Upgraded Spearman; stronger anti-mounted weapon.',
  },
  {
    name: 'Grenadier',
    type: 'melee',
    moves: 2,
    health: 10,
    description: 'Gunpowder melee unit with improved combat against melee.',
  },
  {
    name: 'Archer',
    type: 'ranged',
    moves: 2,
    health: 10,
    description: 'Early ranged unit; first strike ability.',
  },
  {
    name: 'Longbowman',
    type: 'ranged',
    moves: 2,
    health: 10,
    description: 'Stronger ranged unit with first strike and city defense bonuses.',
  },
  {
    name: 'Crossbowman',
    type: 'ranged',
    moves: 2,
    health: 10,
    description: 'Improved medieval ranged unit; extra first strike vs melee.',
  },
  {
    name: 'Musketman',
    type: 'ranged',
    moves: 2,
    health: 10,
    description: 'Early gunpowder ranged unit.',
  },
  {
    name: 'Rifleman',
    type: 'ranged',
    moves: 2,
    health: 10,
    description: 'Strong ranged unit of Industrial era.',
  },
  {
    name: 'Machine Gun',
    type: 'ranged',
    moves: 2,
    health: 10,
    description: 'Rapid-fire ranged unit with high defense.',
  },
  {
    name: 'Catapult',
    type: 'siege',
    moves: 2,
    health: 10,
    description: 'Early siege unit for bombardment.',
  },
  {
    name: 'Trebuchet',
    type: 'siege',
    moves: 2,
    health: 10,
    description: 'Powerful medieval siege unit.',
  },
  {
    name: 'Cannon',
    type: 'siege',
    moves: 2,
    health: 10,
    description: 'Industrial era siege with bombardment.',
  },
  {
    name: 'Artillery',
    type: 'siege',
    moves: 2,
    health: 10,
    description: 'Advanced siege unit with strong city attacks.',
  },
  {
    name: 'Rocket Artillery',
    type: 'siege',
    moves: 2,
    health: 10,
    description: 'Modern siege unit with long-range bombardment.',
  },
  {
    name: 'Chariot',
    type: 'mounted',
    moves: 4,
    health: 10,
    description: 'Early mounted melee unit, fast strikes.',
  },
  {
    name: 'Horseman',
    type: 'mounted',
    moves: 4,
    health: 10,
    description: 'Ancient-era cavalry unit.',
  },
  {
    name: 'Knight',
    type: 'mounted',
    moves: 4,
    health: 10,
    description: 'Medieval heavy cavalry.',
  },
  {
    name: 'Mounted Cannon',
    type: 'mounted',
    moves: 4,
    health: 10,
    description: 'Cannonized horse-mounted unit.',
  },
  {
    name: 'Cavalry',
    type: 'mounted',
    moves: 4,
    health: 10,
    description: 'Industrial-era cavalry with high mobility.',
  },
  {
    name: 'Lancer',
    type: 'mounted',
    moves: 4,
    health: 10,
    description: 'Light fast cavalry of Industrial era.',
  },
  {
    name: 'Tank',
    type: 'armored',
    moves: 4,
    health: 10,
    description: 'Heavy armored unit; great for breakthroughs.',
  },
  {
    name: 'Modern Armor',
    type: 'armored',
    moves: 4,
    health: 10,
    description: 'Advanced tank with superior strength and range.',
  },
  {
    name: 'Fighter',
    type: 'air',
    moves: 1,
    health: 10,
    description: 'Air superiority unit.',
  },
  {
    name: 'Bomber',
    type: 'air',
    moves: 1,
    health: 10,
    description: 'Strategic bomber for city and unit bombardment.',
  },
  {
    name: 'Jet Fighter',
    type: 'air',
    moves: 1,
    health: 10,
    description: 'Modern air superiority fighter.',
  },
  {
    name: 'Stealth Bomber',
    type: 'air',
    moves: 1,
    health: 10,
    description: 'High-damage bomber with stealth capabilities.',
  },
  {
    name: 'Trireme',
    type: 'naval melee',
    moves: 5,
    health: 10,
    description: 'Ancient naval combat ship.',
  },
  {
    name: 'Galleon',
    type: 'naval melee',
    moves: 6,
    health: 10,
    description: 'Medieval naval melee unit.',
  },
  {
    name: 'Frigate',
    type: 'naval melee',
    moves: 7,
    health: 10,
    description: 'Renaissance naval ship for melee combat.',
  },
  {
    name: 'Destroyer',
    type: 'naval ranged',
    moves: 8,
    health: 10,
    description: 'Modern ship with ranged attack capability.',
  },
  {
    name: 'Cruiser',
    type: 'naval ranged',
    moves: 8,
    health: 10,
    description: 'Industrial-era naval ranged unit.',
  },
  {
    name: 'Battleship',
    type: 'naval melee',
    moves: 7,
    health: 10,
    description: 'Heavy naval melee vessel of early Industrial era.',
  },
  {
    name: 'Carrier',
    type: 'naval melee',
    moves: 7,
    health: 10,
    description: 'Naval carrier; can transport air units.',
  },
  {
    name: 'Submarine',
    type: 'naval melee',
    moves: 7,
    health: 10,
    description: 'Stealthy naval melee unit when surfaced.',
  },
  {
    name: 'Scout',
    type: 'recon',
    moves: 2,
    health: 10,
    description: 'Light unit for exploration; weak in combat.',
  },
  {
    name: 'Great Person',
    type: 'support',
    moves: 1,
    health: 10,
    description: 'Generates one-time bonuses (production, culture, etc.).',
  },
  {
    name: 'Worker',
    type: 'support',
    moves: 2,
    health: 10,
    description: 'Constructs improvements like roads, farms, mines.',
  },
  {
    name: 'Settler',
    type: 'support',
    moves: 2,
    health: 10,
    description: 'Founds new cities.',
  },
  {
    name: 'Spy',
    type: 'support',
    moves: 2,
    health: 10,
    description: 'Espionage unit (in BtS expansion).',
  },
  {
    name: 'Missionary',
    type: 'support',
    moves: 2,
    health: 10,
    description: 'Spreads religion (in BtS expansion).',
  },
  {
    name: 'Corporate Executive',
    type: 'support',
    moves: 2,
    health: 10,
    description: 'Spreads corporate presence (in BtS expansion).',
  },
];

export const units: UnitDefinition[] = info.map(i => build(i));

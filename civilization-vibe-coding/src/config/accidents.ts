import { AccidentId, TerrainId } from '../models/types';

export interface AccidentConfig {
  id: AccidentId;
  name: string;
  letter: string;
  /** Relative path to the accident icon in public folder */
  icon: string;
  spawnChance: Partial<Record<TerrainId, number>>;
}

export const accidents: AccidentConfig[] = [
  {
    id: 'hill',
    name: 'Hill',
    letter: 'H',
    icon: '/icons/accidents/hill.svg',
    spawnChance: { plains: 0.3, grassland: 0.3, desert: 0.2, tundra: 0.15, snow: 0.05 }
  },
  {
    id: 'mountain',
    name: 'Mountain',
    letter: 'M',
    icon: '/icons/accidents/mountain.svg',
    spawnChance: { plains: 0.2, grassland: 0.2, desert: 0.2, tundra: 0.2, snow: 0.2 }
  },
  {
    id: 'swamp',
    name: 'Swamp',
    letter: 'S',
    icon: '/icons/accidents/swamp.svg',
    spawnChance: { plains: 0.1, grassland: 0.15 }
  },
  {
    id: 'forest',
    name: 'Forest',
    letter: 'F',
    icon: '/icons/accidents/forest.svg',
    spawnChance: { plains: 0.2, grassland: 0.3, tundra: 0.05 }
  },
  {
    id: 'jungle',
    name: 'Jungle',
    letter: 'J',
    icon: '/icons/accidents/jungle.svg',
    spawnChance: { grassland: 0.2 }
  },
  {
    id: 'river',
    name: 'River',
    letter: 'R',
    icon: '/icons/accidents/river.svg',
    spawnChance: { plains: 0.1, grassland: 0.1, desert: 0.05, tundra: 0.05 }
  },
  {
    id: 'coast',
    name: 'Coast',
    letter: 'C',
    icon: '/icons/accidents/coast.svg',
    spawnChance: { ocean: 0.3 }
  }
];
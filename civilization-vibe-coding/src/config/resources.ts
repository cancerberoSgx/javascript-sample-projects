import { ResourceId, TerrainId } from '../models/types';

export interface ResourceConfig {
  id: ResourceId;
  name: string;
  letter: string;
  /** Relative path to the resource icon in public folder */
  icon?: string;
  spawnChance: Partial<Record<TerrainId, number>>;
}

const foodResources : ResourceConfig[] = [
  {
    id: 'wheat',
    name: 'Wheat',
    letter: 'W',
    icon: '/icons/resources/wheat.svg',
    spawnChance: { plains: 0.25, grassland: 0.25 }
  },
  {
    id: 'rice',
    name: 'Rice',
    letter: 'R',
    icon: '/icons/resources/rice.svg',
    spawnChance: { plains: 0.15, grassland: 0.2 }
  },
  {
    id: 'corn',
    name: 'Corn',
    letter: 'C',
    icon: '/icons/resources/corn.svg',
    spawnChance: { plains: 0.2, grassland: 0.2 }
  },
  {
    id: 'cattle',
    name: 'Cattle',
    letter: 'C',
    icon: '/icons/resources/cattle.svg',
    spawnChance: { plains: 0.2, grassland: 0.15 }
  },
  {
    id: 'sheep',
    name: 'Sheep',
    letter: 'S',
    icon: '/icons/resources/sheep.svg',
    spawnChance: { plains: 0.1, grassland: 0.15, tundra: 0.1 }
  },
  {
    id: 'deer',
    name: 'Deer',
    letter: 'D',
    icon: '/icons/resources/deer.svg',
    spawnChance: { plains: 0.15, grassland: 0.15, tundra: 0.05 }
  },
  {
    id: 'fish',
    name: 'Fish',
    letter: 'F',
    icon: '/icons/resources/fish.svg',
    spawnChance: { ocean: 0.4 }
  },
  {
    id: 'bananas',
    name: 'Bananas',
    letter: 'B',
    icon: '/icons/resources/bananas.svg',
    spawnChance: { grassland: 0.2 }
  },
  {
    id: 'crabs',
    name: 'Crabs',
    letter: 'C',
    icon: '/icons/resources/crabs.svg',
    spawnChance: { ocean: 0.3 }
  }
];


const strategicResources : ResourceConfig[] = [
  {
    id: 'iron',
    name: 'Iron',
    letter: 'I',
    icon: '/icons/resources/iron.svg',
    spawnChance: { plains: 0.1, grassland: 0.1, desert: 0.1, tundra: 0.1, snow: 0.1 }
  },
  {
    id: 'coal',
    name: 'Coal',
    letter: 'C',
    icon: '/icons/resources/coal.svg',
    spawnChance:  { plains: 0.1, grassland: 0.1, desert: 0.1, tundra: 0.1, snow: 0.1 }
  },
  {
    id: 'horses',
    name: 'Horses',
    letter: 'H',
    icon: '/icons/resources/horses.svg',
    spawnChance: {  plains: 0.1, grassland: 0.1, desert: 0.1, tundra: 0.1, snow: 0.1  }
  },
  {
    id: 'oil',
    name: 'Oil',
    letter: 'O',
    icon: '/icons/resources/oil.svg',
    spawnChance:  {  plains: 0.1, grassland: 0.1, desert: 0.1, tundra: 0.1, snow: 0.1  }
  },
  {
    id: 'aluminum',
    name: 'Aluminum',
    letter: 'S',
    icon: '/icons/resources/aluminum.svg',
    spawnChance:  {  plains: 0.1, grassland: 0.1, desert: 0.1, tundra: 0.1, snow: 0.1  }
  },
  {
    id: 'uranium',
    name: 'Uranium',
    letter: 'U',
    icon: '/icons/resources/uranium.svg',
    spawnChance:  {  plains: 0.1, grassland: 0.1, desert: 0.1, tundra: 0.1, snow: 0.1  }
  },
  {
    id: 'copper',
    name: 'Copper',
    letter: 'C',
    icon: '/icons/resources/copper.svg',
    spawnChance:  {  plains: 0.1, grassland: 0.1, desert: 0.1, tundra: 0.1, snow: 0.1  }
  },
];


const luxuryResources : ResourceConfig[] = [
  {
    id: 'gold',
    name: 'Gold',
    letter: 'G',
    icon: '/icons/resources/gold.svg',
    spawnChance: { plains: 0.1, grassland: 0.1, desert: 0.1, tundra: 0.1, snow: 0.1 }
  },
  {
    id: 'silver',
    name: 'Silver',
    letter: 'S',
    icon: '/icons/resources/silver.svg',
    spawnChance: { plains: 0.1, grassland: 0.1, desert: 0.1, tundra: 0.1, snow: 0.1 }
  },
  {
    id: 'gems',
    name: 'Gems',
    letter: 'G',
    icon: '/icons/resources/gems.svg',
    spawnChance: { plains: 0.1, grassland: 0.1, desert: 0.1, tundra: 0.1, snow: 0.1 }
  },
  {
    id: 'ivory',
    name: 'Ivory',
    letter: 'I',
    icon: '/icons/resources/ivory.svg',
    spawnChance: { plains: 0.2, grassland: 0.01, desert: 0.1 }
  },
  {
    id: 'silk',
    name: 'Silk',
    letter: 'S',
    icon: '/icons/resources/silk.svg',
    spawnChance: { plains: 0.1, grassland: 0.1, desert: 0.1 }
  },
  {
    id: 'spices',
    name: 'Spices',
    letter: 'S',
    icon: '/icons/resources/spices.svg',
    spawnChance: { plains: 0.1, grassland: 0.1, desert: 0.1 }
  },
  {
    id: 'Sugar',
    name: 'Sugar',
    letter: 'S',
    icon: '/icons/resources/sugar.svg',
    spawnChance: { plains: 0.1, grassland: 0.1, desert: 0.1 }
  },
  {
    id: 'Wine',
    name: 'Wine',
    letter: 'W',
    icon: '/icons/resources/wine.svg',
    spawnChance: { plains: 0.1, grassland: 0.1, desert: 0.1, tundra: 0.1 }
  },
  {
    id: 'Incense',
    name: 'Incense',
    letter: 'I',
    icon: '/icons/resources/incense.svg',
    spawnChance: { plains: 0.1, grassland: 0.1, desert: 0.1 }
  },
  // {
  //   id: 'Tobacco',
  //   name: 'Tobacco',
  //   letter: 'T',
  //   spawnChance: { plains: 0.1, grassland: 0.1,  }
  // },
  {
    id: 'Cotton',
    name: 'Cotton',
    letter: 'C',
    icon: '/icons/resources/cotton.svg',
    spawnChance: { plains: 0.1, grassland: 0.1 }
  },
  {
    id: 'Dyes',
    name: 'Dyes',
    letter: 'S',
    icon: '/icons/resources/dyes.svg',
    spawnChance: { plains: 0.1, grassland: 0.1, desert: 0.1, tundra: 0.1 }
  }

  // TODO: not in civ4: Cocoa, Coffee, Tea, Tobacco

];


export const resources : ResourceConfig[] = [...foodResources, ...strategicResources, ...luxuryResources]
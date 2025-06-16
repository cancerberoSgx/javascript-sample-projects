import { TerrainId } from '../models/types';

export interface TerrainConfig {
  id: TerrainId;
  name: string;
  color: string;
}

export const terrains: TerrainConfig[] = [
  { id: 'plains', name: 'Plains', color: '#c2b280' },
  { id: 'grassland', name: 'Grassland', color: '#a5ab22' },
  { id: 'desert', name: 'Desert', color: '#ffdb00' },
  { id: 'tundra', name: 'Tundra', color: '#bbbbaa' },
  { id: 'snow', name: 'Snow', color: '#ffffff' },
  { id: 'ocean', name: 'Ocean', color: '#3f5df7' }
];
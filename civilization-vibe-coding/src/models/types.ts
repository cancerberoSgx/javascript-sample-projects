export type TerrainId = string;
export type UnitId = string;
export type CityId = string;
export type AccidentId = string;
export type ResourceId = string;
export type PlayerId = number;

export interface Player {
  id: PlayerId;
  civilizationId: number;
  name: string;
  color: string;
}

export interface UnitInstance {
  id: UnitId;
  type: string;
  x: number;
  y: number;
  owner: PlayerId;
}

export interface CityInstance {
  id: CityId;
  name: string;
  x: number;
  y: number;
  owner: PlayerId;
}

export type TerrainLayout =
  | 'random'
  | 'continents'
  | 'islands'
  | 'panagea'
  | 'inlandSea'
  | 'lakes';

export interface GameState {
  mapWidth: number;
  mapHeight: number;
  mapLayout: TerrainLayout;
  cellSize: number;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (cellSize: number)=>void
  setMapLayout: (layout: TerrainLayout) => void;
  setMapWidth: (width: number) => void;
  setMapHeight: (height: number) => void;
  terrainMap: TerrainId[];
  /** List of accident IDs per tile (0 or more accidents) */
  accidentMap: AccidentId[][];
  resourceMap: (ResourceId | null)[];
  units: Record<UnitId, UnitInstance>;
  cities: Record<CityId, CityInstance>;
  playersCount: number;
  setPlayersCount: (count: number) => void;
  players: Player[];
  currentTurn: PlayerId;
  nextTurn: () => void;
  moveUnit: (unitId: UnitId, x: number, y: number) => void;
}
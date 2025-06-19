import create from 'zustand';
import { GameState, TerrainLayout } from '../models/types';
import { GenerateMapParams, generateMap } from './generateMap';

export const useGameStore = create<GameState>((set, get) => {
  const initialWidth = 60;
  const initialHeight = 30;
  const initialLayout: TerrainLayout = 'continents';
  const initialPlayersCount = 5;
  const { terrainMap, accidentMap, resourceMap, units, cities, players } = generateMap({
    width: initialWidth,
    height: initialHeight,
    layout: initialLayout,
    playersCount: initialPlayersCount,
  });

  return {
    mapWidth: initialWidth,
    mapHeight: initialHeight,
    mapLayout: initialLayout,
    playersCount: initialPlayersCount,
    players,
    setMapLayout: (newLayout: TerrainLayout) => {
      const { mapWidth, mapHeight } = get();
      const {
        terrainMap: newTerrainMap,
        accidentMap: newAccidentMap,
        resourceMap: newResourceMap,
        units: newUnits,
        cities: newCities,
        players: newPlayers,
      } = generateMap({
        width: mapWidth,
        height: mapHeight,
        layout: newLayout,
        playersCount: get().playersCount,
      });
      set({
        mapLayout: newLayout,
        terrainMap: newTerrainMap,
        accidentMap: newAccidentMap,
        resourceMap: newResourceMap,
        units: newUnits,
        cities: newCities,
        players: newPlayers,
        currentTurn: 1,
      });
    },
    setMapWidth: (newWidth: number) => {
      const { mapHeight, mapLayout, playersCount } = get();
      const {
        terrainMap: newTerrainMap,
        accidentMap: newAccidentMap,
        resourceMap: newResourceMap,
        units: newUnits,
        cities: newCities,
        players: newPlayers,
      } = generateMap({
        width: newWidth,
        height: mapHeight,
        layout: mapLayout,
        playersCount,
      });
      set({
        mapWidth: newWidth,
        terrainMap: newTerrainMap,
        accidentMap: newAccidentMap,
        resourceMap: newResourceMap,
        units: newUnits,
        cities: newCities,
        players: newPlayers,
        currentTurn: 1,
      });
    },
    setMapHeight: (newHeight: number) => {
      const { mapWidth, mapLayout, playersCount } = get();
      const {
        terrainMap: newTerrainMap,
        accidentMap: newAccidentMap,
        resourceMap: newResourceMap,
        units: newUnits,
        cities: newCities,
        players: newPlayers,
      } = generateMap({
        width: mapWidth,
        height: newHeight,
        layout: mapLayout,
        playersCount,
      });
      set({
        mapHeight: newHeight,
        terrainMap: newTerrainMap,
        accidentMap: newAccidentMap,
        resourceMap: newResourceMap,
        units: newUnits,
        cities: newCities,
        players: newPlayers,
        currentTurn: 1,
      });
    },
    cellSize: 128,
    zoomIn: () =>
      set(state => ({
        cellSize: Math.min(Math.round(state.cellSize * 1.2), 196),
      })),
    zoomOut: () =>
      set(state => ({
        cellSize: Math.max(Math.round(state.cellSize / 1.2), 4),
      })),
    setZoom: (cellSize: number) => {
      set(state => ({
        cellSize,
      }));
    },
    setPlayersCount: (newCount: number) => {
      const { mapWidth, mapHeight, mapLayout } = get();
      const { terrainMap: newTerrainMap, accidentMap: newAccidentMap, resourceMap: newResourceMap, units: newUnits, cities: newCities, players: newPlayers } = generateMap({ width: mapWidth, height: mapHeight, layout: mapLayout, playersCount: newCount });
      set({
        playersCount: newCount,
        players: newPlayers,
        terrainMap: newTerrainMap,
        accidentMap: newAccidentMap,
        resourceMap: newResourceMap,
        units: newUnits,
        cities: newCities,
        currentTurn: 1,
      });
    },
    terrainMap,
    accidentMap,
    resourceMap,
    units,
    cities,
    currentTurn: 1,
    nextTurn: () => set({ currentTurn: get().currentTurn + 1 }),
    moveUnit: (unitId, x, y) =>
      set(state => ({
        units: {
          ...state.units,
          [unitId]: { ...state.units[unitId], x, y },
        },
      })),
  };
});

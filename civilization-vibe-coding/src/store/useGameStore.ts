import create from 'zustand';
import { GameState, TerrainLayout } from '../models/types';
import { GenerateMapParams, generateMap } from './generateMap';

export const useGameStore = create<GameState>((set, get) => {
  const initialWidth = 60;
  const initialHeight = 30;
  const initialLayout: TerrainLayout = 'continents';
  const { terrainMap, accidentMap, resourceMap, units, cities } =
    generateMap({ width: initialWidth, height: initialHeight, layout: initialLayout });

  return {
    mapWidth: initialWidth,
    mapHeight: initialHeight,
    mapLayout: initialLayout,
    setMapLayout: (newLayout: TerrainLayout) => {
      const { mapWidth, mapHeight } = get();
      const {
        terrainMap: newTerrainMap,
        accidentMap: newAccidentMap,
        resourceMap: newResourceMap,
        units: newUnits,
        cities: newCities,
      } = generateMap({ width: mapWidth, height: mapHeight, layout: newLayout });
      set({
        mapLayout: newLayout,
        terrainMap: newTerrainMap,
        accidentMap: newAccidentMap,
        resourceMap: newResourceMap,
        units: newUnits,
        cities: newCities,
        currentTurn: 1,
      });
    },
    setMapWidth: (newWidth: number) => {
      const { mapHeight, mapLayout } = get();
      const {
        terrainMap: newTerrainMap,
        accidentMap: newAccidentMap,
        resourceMap: newResourceMap,
        units: newUnits,
        cities: newCities,
      } = generateMap({ width: newWidth, height: mapHeight, layout: mapLayout });
      set({
        mapWidth: newWidth,
        terrainMap: newTerrainMap,
        accidentMap: newAccidentMap,
        resourceMap: newResourceMap,
        units: newUnits,
        cities: newCities,
        currentTurn: 1,
      });
    },
    setMapHeight: (newHeight: number) => {
      const { mapWidth, mapLayout } = get();
      const {
        terrainMap: newTerrainMap,
        accidentMap: newAccidentMap,
        resourceMap: newResourceMap,
        units: newUnits,
        cities: newCities,
      } = generateMap({ width: mapWidth, height: newHeight, layout: mapLayout });
      set({
        mapHeight: newHeight,
        terrainMap: newTerrainMap,
        accidentMap: newAccidentMap,
        resourceMap: newResourceMap,
        units: newUnits,
        cities: newCities,
        currentTurn: 1,
      });
    },
    cellSize: 32,
    zoomIn: () =>
      set((state) => ({
        cellSize: Math.min(Math.round(state.cellSize * 1.2), 196),
      })),
    zoomOut: () =>
      set((state) => ({
        cellSize: Math.max(Math.round(state.cellSize / 1.2), 4),
      })),
    terrainMap,
    accidentMap,
    resourceMap,
    units,
    cities,
    currentTurn: 1,
    nextTurn: () => set({ currentTurn: get().currentTurn + 1 }),
    moveUnit: (unitId, x, y) =>
      set((state) => ({
        units: {
          ...state.units,
          [unitId]: { ...state.units[unitId], x, y },
        },
      })),
  };
});
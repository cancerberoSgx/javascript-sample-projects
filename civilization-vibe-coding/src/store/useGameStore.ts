import create from 'zustand';
import { GameState, TerrainLayout, PlayerType } from '../models/types';
import { GenerateMapParams, generateMap } from './map/generateMap';
import { units as unitTypes } from '../config/units';
import { initialHeight, initialPlayersCount, initialWidth } from './constants';

export const useGameStore = create<GameState>((set, get) => {

  const initialLayout: TerrainLayout = 'continents';
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
    cellSize: 196,
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
    nextTurn: () =>
      set(state => {
        let newCurrent = state.currentTurn;
        const { players, terrainMap, mapWidth, mapHeight } = state;
        const newUnits = { ...state.units };

        while (true) {
          newCurrent = (newCurrent % players.length) + 1;
          const player = players.find(p => p.id === newCurrent);
          if (!player || player.type !== PlayerType.ai) {
            break;
          }
          Object.values(newUnits).forEach(u => {
            if (u.owner === newCurrent) {
              const def = unitTypes.find(t => t.id === u.type);
              const moves = def?.moves ?? 0;
              if (moves > 0) {
                const candidates: { x: number; y: number }[] = [];
                for (let dx = -moves; dx <= moves; dx++) {
                  const maxDy = moves - Math.abs(dx);
                  for (let dy = -maxDy; dy <= maxDy; dy++) {
                    const nx = u.x + dx;
                    const ny = u.y + dy;
                    if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight) {
                      const terrain = terrainMap[ny * mapWidth + nx];
                      if (terrain !== 'ocean') {
                        candidates.push({ x: nx, y: ny });
                      }
                    }
                  }
                }
                if (candidates.length > 0) {
                  const choice = candidates[Math.floor(Math.random() * candidates.length)];
                  newUnits[u.id] = { ...u, x: choice.x, y: choice.y };
                }
              }
            }
          });
        }

        return { currentTurn: newCurrent, units: newUnits };
      }),
    moveUnit: (unitId, x, y) =>
      set(state => ({
        units: {
          ...state.units,
          [unitId]: { ...state.units[unitId], x, y },
        },
      })),
  };
});

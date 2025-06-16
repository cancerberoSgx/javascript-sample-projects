import { resources } from '../config/resources';
import { terrains } from '../config/terrains';
import { units as unitConfigs } from '../config/units';
import { TerrainId, TerrainLayout, AccidentId, ResourceId, UnitInstance, CityInstance } from '../models/types';

const GLOBAL_RESOURCE_PROB = 0.1;
const GLOBAL_UNIT_PROB = 0.05;
const GLOBAL_CITY_PROB = 0.02;
function chooseTerrainByLatitude(x: number, y: number, width: number, height: number): TerrainId {
  const rel = Math.abs(y / (height - 1) - 0.5) * 2;
  if (rel <= 0.2) {
    if (Math.random() < 0.3) {
      return 'desert';
    }
    return Math.random() < 0.5 ? 'grassland' : 'plains';
  } else if (rel <= 0.6) {
    return Math.random() < 0.5 ? 'grassland' : 'plains';
  } else if (rel <= 0.8) {
    return 'tundra';
  }
  return 'snow';
}
function createRandomTerrainMap(width: number, height: number): TerrainId[] {
  const terrainIds = terrains.map((t) => t.id);
  const map: TerrainId[] = [];
  for (let i = 0; i < width * height; i++) {
    map[i] = terrainIds[Math.floor(Math.random() * terrainIds.length)];
  }
  return map;
}
function createContinentsTerrainMap(width: number, height: number): TerrainId[] {
  console.log('createContinentsTerrainMap', { width, height });

  const size = width * height;
  const landMask = new Array<boolean>(size).fill(false);
  const numContinents = Math.floor(2 + Math.random() * 3);
  for (let c = 0; c < numContinents; c++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const rX = (width / numContinents) * (0.5 + Math.random() * 0.5);
    const rY = (height / numContinents) * (0.5 + Math.random() * 0.5);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - cx) / rX;
        const dy = (y - cy) / rY;
        if (dx * dx + dy * dy <= 1) {
          landMask[y * width + x] = true;
        }
      }
    }
  }
  const map: TerrainId[] = new Array<TerrainId>(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      map[idx] = landMask[idx]
        ? chooseTerrainByLatitude(x, y, width, height)
        : 'ocean';
    }
  }
  return map;
}
function createIslandsTerrainMap(width: number, height: number): TerrainId[] {
  const size = width * height;
  const landMask = new Array<boolean>(size).fill(false);
  const numIslands = Math.floor(10 + Math.random() * 10);
  for (let i = 0; i < numIslands; i++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const rX = (width / numIslands) * (0.5 + Math.random() * 0.5);
    const rY = (height / numIslands) * (0.5 + Math.random() * 0.5);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - cx) / rX;
        const dy = (y - cy) / rY;
        if (dx * dx + dy * dy <= 1) {
          landMask[y * width + x] = true;
        }
      }
    }
  }
  const map: TerrainId[] = new Array<TerrainId>(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      map[idx] = landMask[idx]
        ? chooseTerrainByLatitude(x, y, width, height)
        : 'ocean';
    }
  }
  return map;
}
function createPanageaTerrainMap(width: number, height: number): TerrainId[] {
  const size = width * height;
  const landMask = new Array<boolean>(size).fill(false);
  const cx = width / 2;
  const cy = height / 2;
  const rX = width * (0.5 + Math.random() * 0.3);
  const rY = height * (0.5 + Math.random() * 0.3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - cx) / rX;
      const dy = (y - cy) / rY;
      if (dx * dx + dy * dy <= 1) {
        landMask[y * width + x] = true;
      }
    }
  }
  const map: TerrainId[] = new Array<TerrainId>(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      map[idx] = landMask[idx]
        ? chooseTerrainByLatitude(x, y, width, height)
        : 'ocean';
    }
  }
  return map;
}
function createInlandSeaTerrainMap(width: number, height: number): TerrainId[] {
  const size = width * height;
  const seaMask = new Array<boolean>(size).fill(false);
  const cx = width / 2;
  const cy = height / 2;
  const rX = width * (0.3 + Math.random() * 0.2);
  const rY = height * (0.3 + Math.random() * 0.2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - cx) / rX;
      const dy = (y - cy) / rY;
      if (dx * dx + dy * dy <= 1) {
        seaMask[y * width + x] = true;
      }
    }
  }
  const map: TerrainId[] = new Array<TerrainId>(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      map[idx] = seaMask[idx]
        ? 'ocean'
        : chooseTerrainByLatitude(x, y, width, height);
    }
  }
  return map;
}
function createLakesTerrainMap(width: number, height: number): TerrainId[] {
  const size = width * height;
  const lakeMask = new Array<boolean>(size).fill(false);
  const numLakes = Math.floor(2 + Math.random() * 4);
  for (let i = 0; i < numLakes; i++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const rX = (width / numLakes) * (0.3 + Math.random() * 0.4);
    const rY = (height / numLakes) * (0.3 + Math.random() * 0.4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - cx) / rX;
        const dy = (y - cy) / rY;
        if (dx * dx + dy * dy <= 1) {
          lakeMask[y * width + x] = true;
        }
      }
    }
  }
  const map: TerrainId[] = new Array<TerrainId>(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      map[idx] = lakeMask[idx]
        ? 'ocean'
        : chooseTerrainByLatitude(x, y, width, height);
    }
  }
  return map;
}
function createTerrainMap(
  layout: TerrainLayout,
  width: number,
  height: number
): TerrainId[] {
  switch (layout) {
    case 'continents':
      return createContinentsTerrainMap(width, height);
    case 'islands':
      return createIslandsTerrainMap(width, height);
    case 'panagea':
      return createPanageaTerrainMap(width, height);
    case 'inlandSea':
      return createInlandSeaTerrainMap(width, height);
    case 'lakes':
      return createLakesTerrainMap(width, height);
    case 'random':
    default:
      return createRandomTerrainMap(width, height);
  }
}
// Helpers for accident generation and clustering
interface Region {
  minY: number;
  maxY: number;
}
function getIndex(x: number, y: number, width: number): number {
  return y * width + x;
}
function getXY(index: number, width: number): { x: number; y: number; } {
  return { x: index % width, y: Math.floor(index / width) };
}
function getNeighbors(x: number, y: number, width: number, height: number): { x: number; y: number; }[] {
  const neighbors: { x: number; y: number; }[] = [];
  if (x > 0) neighbors.push({ x: x - 1, y });
  if (x < width - 1) neighbors.push({ x: x + 1, y });
  if (y > 0) neighbors.push({ x, y: y - 1 });
  if (y < height - 1) neighbors.push({ x, y: y + 1 });
  return neighbors;
}
function generateClusters(
  map: AccidentId[][],
  width: number,
  height: number,
  terrainMap: TerrainId[],
  allowedTerrains: TerrainId[],
  accidentId: AccidentId,
  clusterCount: number,
  clusterSizeRange: [number, number],
  region?: Region
): void {
  const minRow = region ? Math.floor(region.minY * (height - 1)) : 0;
  const maxRow = region ? Math.floor(region.maxY * (height - 1)) : height - 1;
  for (let i = 0; i < clusterCount; i++) {
    let seedIndex: number | null = null;
    for (let attempts = 0; attempts < 1000; attempts++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      const idx = getIndex(x, y, width);
      if (allowedTerrains.includes(terrainMap[idx]) &&
        map[idx].length === 0 &&
        y >= minRow &&
        y <= maxRow) {
        seedIndex = idx;
        break;
      }
    }
    if (seedIndex === null) continue;
    const [minSize, maxSize] = clusterSizeRange;
    const clusterSize = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
    const clusterCells: number[] = [seedIndex];
    if (!map[seedIndex].includes(accidentId)) map[seedIndex].push(accidentId);
    while (clusterCells.length < clusterSize) {
      const current = clusterCells[Math.floor(Math.random() * clusterCells.length)];
      const { x, y } = getXY(current, width);
      const neighbors = getNeighbors(x, y, width, height)
        .map(({ x, y }) => getIndex(x, y, width))
        .filter(
          (n) => allowedTerrains.includes(terrainMap[n]) &&
            map[n].length === 0 &&
            n >= getIndex(0, minRow, width) &&
            n <= getIndex(width - 1, maxRow, width)
        );
      if (neighbors.length === 0) break;
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      if (!map[next].includes(accidentId)) map[next].push(accidentId);
      clusterCells.push(next);
    }
  }
}
function generateCoast(
  map: AccidentId[][],
  width: number,
  height: number,
  terrainMap: TerrainId[]
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = getIndex(x, y, width);
      if (terrainMap[idx] === 'ocean') {
        const adj = getNeighbors(x, y, width, height);
        if (adj.some(({ x: nx, y: ny }) => terrainMap[getIndex(nx, ny, width)] !== 'ocean')) {
          if (!map[idx].includes('coast')) map[idx].push('coast');
        }
      }
    }
  }
}
// function generateMountains(
//   map: AccidentId[][],
//   width: number,
//   height: number,
//   terrainMap: TerrainId[]
// ): void {
//   const stripeCount = Math.floor(Math.random() * 3) + 1;
//   for (let i = 0; i < stripeCount; i++) {
//     const horizontal = Math.random() < 0.5;
//     if (horizontal) {
//       const y = Math.floor(Math.random() * height);
//       const segments: { start: number; length: number }[] = [];
//       let start: number | null = null;
//       let len = 0;
//       for (let x = 0; x < width; x++) {
//         const idx = getIndex(x, y, width);
//         if (terrainMap[idx] !== 'ocean') {
//           if (start === null) start = x;
//           len++;
//         } else if (start !== null) {
//           segments.push({ start, length: len });
//           start = null;
//           len = 0;
//         }
//       }
//       if (start !== null) segments.push({ start, length: len });
//       if (segments.length === 0) continue;
//       const seg = segments[Math.floor(Math.random() * segments.length)];
//       const stripeLen = Math.max(Math.ceil(seg.length / 4), Math.floor(Math.random() * Math.floor(seg.length / 2)));
//       const stripeStart = seg.start + Math.floor(Math.random() * (seg.length - stripeLen + 1));
//       console.log('generateMountains horizontal',{stripeLen, stripeStart} );
//       for (let dx = 0; dx < stripeLen; dx++) {
//         const idx = getIndex(stripeStart + dx, y, width);
//         if (!map[idx].includes('mountain')) map[idx].push('mountain');
//       }
//     } else {
//       const x = Math.floor(Math.random() * width);
//       const segments: { start: number; length: number }[] = [];
//       let start: number | null = null;
//       let len = 0;
//       for (let y0 = 0; y0 < height; y0++) {
//         const idx = getIndex(x, y0, width);
//         if (terrainMap[idx] !== 'ocean') {
//           if (start === null) start = y0;
//           len++;
//         } else if (start !== null) {
//           segments.push({ start, length: len });
//           start = null;
//           len = 0;
//         }
//       }
//       if (start !== null) segments.push({ start, length: len });
//       if (segments.length === 0) continue;
//       const seg = segments[Math.floor(Math.random() * segments.length)];
//       const stripeLen = Math.max(Math.ceil(seg.length / 4), Math.floor(Math.random() * Math.floor(seg.length / 2)));
//       const stripeStart = seg.start + Math.floor(Math.random() * (seg.length - stripeLen + 1));
//       console.log('generateMountains vertical',{stripeLen, stripeStart} );
//   for (let dy = 0; dy < stripeLen; dy++) {
//         const idx = getIndex(x, stripeStart + dy, width);
//         if (!map[idx].includes('mountain')) map[idx].push('mountain');
//       }
//     }
//   }
// }
function generateHills(
  map: AccidentId[][],
  width: number,
  height: number,
  terrainMap: TerrainId[]
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = getIndex(x, y, width);
      if (map[idx].includes('mountain')) {
        getNeighbors(x, y, width, height).forEach(({ x: nx, y: ny }) => {
          const nIdx = getIndex(nx, ny, width);
          if (terrainMap[nIdx] !== 'ocean' && !map[nIdx].includes('hill')) {
            map[nIdx].push('hill');
          }
        });
      }
    }
  }
}
function generateRivers(
  map: AccidentId[][],
  width: number,
  height: number,
  terrainMap: TerrainId[]
): void {
  const mountains = map
    .map((v, idx) => (v.includes('mountain') ? idx : -1))
    .filter((idx) => idx >= 0);
  const coasts = terrainMap
    .map((t, idx) => (t === 'ocean' && map[idx].includes('coast') ? idx : -1))
    .filter((idx) => idx >= 0);

  const riverCount = Math.max(1, Math.floor(mountains.length / 2));
  for (let i = 0; i < riverCount; i++) {
    const start = mountains[Math.floor(Math.random() * mountains.length)];
    const target = coasts[Math.floor(Math.random() * coasts.length)];
    let { x, y } = getXY(start, width);
    const { x: tx, y: ty } = getXY(target, width);
    let steps = 0;
    while ((x !== tx || y !== ty) && steps < width * height) {
      const idx = getIndex(x, y, width);
      if (terrainMap[idx] !== 'ocean' && !map[idx].includes('river')) {
        map[idx].push('river');
      }
      const dx = tx - x;
      const dy = ty - y;
      if (Math.abs(dx) > Math.abs(dy)) {
        x += dx > 0 ? 1 : -1;
      } else if (dy !== 0) {
        y += dy > 0 ? 1 : -1;
      }
      steps++;
    }
  }
}
function createInitialAccidentMap(
  width: number,
  height: number,
  terrainMap: TerrainId[]
): AccidentId[][] {
  const map: AccidentId[][] = new Array(width * height).fill(null).map(() => []);
  generateCoast(map, width, height, terrainMap);
  // Jungle: medium clusters on grassland near equator
  generateClusters(map, width, height, terrainMap, ['grassland'], 'jungle', Math.floor(Math.random() * 4) + 3, [8, 12], { minY: 0.4, maxY: 0.6 });
  // Swamp: medium clusters on grassland near north/south
  generateClusters(map, width, height, terrainMap, ['grassland'], 'swamp', Math.floor(Math.random() * 4) + 3, [8, 12], { minY: 0, maxY: 0.2 });
  generateClusters(map, width, height, terrainMap, ['grassland'], 'swamp', Math.floor(Math.random() * 4) + 3, [8, 12], { minY: 0.8, maxY: 1 });
  // Forest: big clusters on grassland, small clusters on plains and tundra
  // generateClusters(map, width, height, terrainMap, ['grassland', 'plains', 'tundra'], 'forest', Math.floor(Math.random() * 6) + 5, [10, 20]);
  generateClusters(map, width, height, terrainMap, ['grassland'], 'forest', Math.floor(Math.random() * 6) + 5, [10, 20]);
  generateClusters(map, width, height, terrainMap, ['plains'], 'forest', Math.floor(Math.random() * 8) + 8, [3, 7]);
  generateClusters(map, width, height, terrainMap, ['tundra'], 'forest', Math.floor(Math.random() * 5) + 4, [3, 7]);
  generateClusters(map, width, height, terrainMap, ['snow'], 'forest', Math.floor(Math.random() * 5) + 4, [3, 7]);
  generateClusters(map, width, height, terrainMap, ['dessert'], 'forest', Math.floor(Math.random() * 5) + 4, [3, 7]);

  // generateClusters(map, width, height, terrainMap, ['tundra', 'grassland', 'plains', 'snow'], 'mountain', Math.floor(Math.random() * 5) + 4, [3, 7]);
  generateClusters(map, width, height, terrainMap, ['tundra'], 'mountain', Math.floor(Math.random() * 5) + 4, [3, 7]);
  generateClusters(map, width, height, terrainMap, ['dessert'], 'mountain', Math.floor(Math.random() * 5) + 4, [3, 7]);
  generateClusters(map, width, height, terrainMap, ['grassland'], 'mountain', Math.floor(Math.random() * 5) + 4, [3, 7]);
  generateClusters(map, width, height, terrainMap, ['plains'], 'mountain', Math.floor(Math.random() * 5) + 4, [3, 7]);
  generateClusters(map, width, height, terrainMap, ['snow'], 'mountain', Math.floor(Math.random() * 5) + 4, [3, 7]);


  // generateMountains(map, width, height, terrainMap);
  generateHills(map, width, height, terrainMap);
  generateRivers(map, width, height, terrainMap);
  return map;
}
function createInitialResourceMap(
  width: number,
  height: number,
  terrainMap: TerrainId[]
): (ResourceId | null)[] {
  const map: (ResourceId | null)[] = [];
  for (let i = 0; i < width * height; i++) {
    const terrain = terrainMap[i];
    const candidates = resources
      .map((r) => ({ id: r.id, weight: r.spawnChance[terrain] || 0 }))
      .filter((c) => c.weight > 0);
    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight > 0 && Math.random() < GLOBAL_RESOURCE_PROB) {
      let r = Math.random() * totalWeight;
      const chosen = candidates.find((c) => {
        r -= c.weight;
        return r <= 0;
      });
      map[i] = chosen ? chosen.id : null;
    } else {
      map[i] = null;
    }
  }
  return map;
}
export interface GenerateMapParams {
  width: number;
  height: number;
  layout: TerrainLayout;
}
export function generateMap(params: GenerateMapParams) {
  const { width, height, layout: mapLayout } = params;
  const terrainMap = createTerrainMap(mapLayout, width, height);
  const accidentMap = createInitialAccidentMap(width, height, terrainMap);
  const resourceMap = createInitialResourceMap(width, height, terrainMap);
  const units: Record<string, UnitInstance> = {};
  const cities: Record<string, CityInstance> = {};
  let unitCounter = 0;
  let cityCounter = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const terrain = terrainMap[idx];
      if (Math.random() < GLOBAL_UNIT_PROB) {
        const candidates = unitConfigs
          .map((u) => ({ id: u.id, weight: u.spawnChance[terrain] || 0 }))
          .filter((c) => c.weight > 0);
        const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
        if (totalWeight > 0) {
          let r = Math.random() * totalWeight;
          const chosen = candidates.find((c) => {
            r -= c.weight;
            return r <= 0;
          });
          if (chosen) {
            const id = `unit-${unitCounter++}`;
            units[id] = { id, type: chosen.id, x, y, owner: 1 };
          }
        }
      }
      if (Math.random() < GLOBAL_CITY_PROB) {
        const id = `city-${cityCounter++}`;
        cities[id] = { id, name: `City${cityCounter}`, x, y, owner: 1 };
      }
    }
  }
  return { terrainMap, accidentMap, resourceMap, units, cities };
}

import { terrains } from '../../config/terrains';
import { TerrainId, TerrainLayout } from '../../models/types';

export function createTerrainMap(layout: TerrainLayout, width: number, height: number): TerrainId[] {
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
  const terrainIds = terrains.map(t => t.id);
  const map: TerrainId[] = [];
  for (let i = 0; i < width * height; i++) {
    map[i] = terrainIds[Math.floor(Math.random() * terrainIds.length)];
  }
  return map;
}
function createContinentsTerrainMap(width: number, height: number): TerrainId[] {
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
      map[idx] = landMask[idx] ? chooseTerrainByLatitude(x, y, width, height) : 'ocean';
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
      map[idx] = landMask[idx] ? chooseTerrainByLatitude(x, y, width, height) : 'ocean';
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
      map[idx] = landMask[idx] ? chooseTerrainByLatitude(x, y, width, height) : 'ocean';
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
      map[idx] = seaMask[idx] ? 'ocean' : chooseTerrainByLatitude(x, y, width, height);
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
      map[idx] = lakeMask[idx] ? 'ocean' : chooseTerrainByLatitude(x, y, width, height);
    }
  }
  return map;
}
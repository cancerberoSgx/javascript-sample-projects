import React, { useRef, useState, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { terrains } from '../config/terrains';
import { accidents } from '../config/accidents';
import { resources } from '../config/resources';
import { units as unitTypes } from '../config/units';
import './Map.css';


const Map: React.FC = () => {
  const mapWidth = useGameStore((state) => state.mapWidth);
  const mapHeight = useGameStore((state) => state.mapHeight);
  const terrainMap = useGameStore((state) => state.terrainMap);
  const setZoom = useGameStore((state) => state.setZoom);
  const accidentMap = useGameStore((state) => state.accidentMap);
  const resourceMap = useGameStore((state) => state.resourceMap);
  const units = useGameStore((state) => state.units);
  const cities = useGameStore((state) => state.cities);
  const players = useGameStore((state) => state.players);
  const cellSize = useGameStore((state) => state.cellSize);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // const baseCellSizeRef = useRef(cellSize);

  // Draw the entire map once (or when map data/dimensions change), reuse on scroll/zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // const base = baseCellSizeRef.current;
    const base = cellSize
    canvas.width = mapWidth * base;
    canvas.height = mapHeight * base;

    // render terrain
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const idx = y * mapWidth + x;
        const terrainId = terrainMap[idx];
        const terrain = terrains.find((t) => t.id === terrainId);
        ctx.fillStyle = terrain?.color || '#000';
        ctx.fillRect(x * base, y * base, base, base);
      }
    }
    // highlight tiles occupied by a city or unit
    players.forEach((player) => {
      ctx.fillStyle = player.color;
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = 0.2;
      Object.values(cities)
        .filter((c) => c.owner === player.id)
        .forEach((c) => ctx.fillRect(c.x * base, c.y * base, base, base));
      Object.values(units)
        .filter((u) => u.owner === player.id)
        .forEach((u) => ctx.fillRect(u.x * base, u.y * base, base, base));
      ctx.globalAlpha = prevAlpha;
    });
    const iconsSize = base * 0.8;
    
    // render accidents, resources, units, cities
    Object.entries(accidentMap).forEach(([i, arr]) => {
      if (!arr.length) return;
      const idx = Number(i);
      const y = Math.floor(idx / mapWidth);
      const x = idx % mapWidth;
      arr.forEach((accId, k) => {
        const acc = accidents.find((a) => a.id === accId);
        if (acc?.icon) {
          const img = new Image();
          img.src = acc.icon;
          img.onload = () => ctx.drawImage(img, x * base + k * iconsSize, y * base, iconsSize, iconsSize);
        }
      });
    });
    Object.entries(resourceMap).forEach(([i, resId]) => {
      if (!resId) return;
      const idx = Number(i);
      const y = Math.floor(idx / mapWidth);
      const x = idx % mapWidth;
      const res = resources.find((r) => r.id === resId);
      if (res?.icon) {
        const img = new Image();
        img.src = res.icon;
        img.onload = () => ctx.drawImage(img, x * base, y * base, iconsSize, iconsSize);
      }
    });
    Object.values(units).forEach((u, k) => {
      const type = unitTypes.find((t) => t.id === u.type);
      if (type?.image) {
        const img = new Image();
        img.src = type.image;
        img.onload = () => ctx.drawImage(img, u.x * base, u.y * base + base - iconsSize, iconsSize, iconsSize);
      }
    });
    Object.values(cities).forEach((c) => {
      ctx.fillStyle = '#000';
      ctx.font = `${base * 0.5}px sans-serif`;
      ctx.fillText(c.name.charAt(0), c.x * base + base * 0.25, c.y * base + base * 0.75);
    });

    // setTimeout(() => {
      setZoom(30)
    // }, 1000);
  }, [mapWidth, mapHeight, terrainMap, accidentMap, resourceMap, units, cities]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const tileWidth = rect.width / mapWidth;
    const tileHeight = rect.height / mapHeight;
    const x = Math.floor((e.clientX - rect.left) / tileWidth);
    const y = Math.floor((e.clientY - rect.top) / tileHeight);
    setSelected({ x, y });
  };

  return (
    <>
      <div className="map-container">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          style={{ width: mapWidth * cellSize, height: mapHeight * cellSize, cursor: 'pointer' }}
        />
      </div>
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Tile Details ({selected.x}, {selected.y})</h3>
            <ul>
              <li>
                <span
                  style={{
                    display: 'inline-block',
                    width: 24,
                    height: 24,
                    backgroundColor:
                      terrains.find((t) => t.id === terrainMap[selected.y * mapWidth + selected.x])
                        ?.color,
                    marginRight: 8
                  }}
                />
                {terrains.find((t) => t.id === terrainMap[selected.y * mapWidth + selected.x])
                  ?.name}
              </li>
              {accidentMap[selected.y * mapWidth + selected.x].map((accId) => {
                const acc = accidents.find((a) => a.id === accId);
                return (
                  <li key={accId}>
                    {acc?.icon && (
                      <img src={acc.icon} alt={acc.name} width={24} height={24} style={{ marginRight: 8 }} />
                    )}
                    {acc?.name}
                  </li>
                );
              })}
              {(() => {
                const resId = resourceMap[selected.y * mapWidth + selected.x];
                if (!resId) return null;
                const res = resources.find((r) => r.id === resId);
                return (
                  <li>
                    {res?.icon && (
                      <img src={res.icon} alt={res.name} width={24} height={24} style={{ marginRight: 8 }} />
                    )}
                    {res?.name}
                  </li>
                );
              })()}
              {Object.values(units)
                .filter((u) => u.x === selected.x && u.y === selected.y)
                .map((u) => {
                  const type = unitTypes.find((t) => t.id === u.type);
                  return (
                    <li key={u.id}>
                      {/* <span
                        style={{
                          display: 'inline-block',
                          width: 24,
                          height: 24,
                          textAlign: 'center',
                          lineHeight: '24px',
                          border: '1px solid #000',
                          marginRight: 8
                        }}
                      >
                        {type?.letter}
                      </span> */}
                    {type?.image && (
                      <img
                        src={type.image}
                        alt={type.name}
                        width={24}
                        height={24}
                        style={{ marginRight: 8 }}
                      />
                    )}
                    {type?.name}

                    </li>
                  );
                })}
            </ul>
            <button onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
};

export default Map;
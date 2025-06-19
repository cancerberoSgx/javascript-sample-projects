import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { TerrainLayout } from '../models/types';

const Controls: React.FC = () => {
  const currentTurn = useGameStore(state => state.currentTurn);
  const nextTurn = useGameStore(state => state.nextTurn);
  const cellSize = useGameStore(state => state.cellSize);
  const zoomIn = useGameStore(state => state.zoomIn);
  const zoomOut = useGameStore(state => state.zoomOut);
  const mapLayout = useGameStore(state => state.mapLayout);
  const setMapLayout = useGameStore(state => state.setMapLayout);
  const mapWidth = useGameStore(state => state.mapWidth);
  const mapHeight = useGameStore(state => state.mapHeight);
  const playersCount = useGameStore(state => state.playersCount);
  const setPlayersCount = useGameStore(state => state.setPlayersCount);
  const setMapWidth = useGameStore(state => state.setMapWidth);
  const setMapHeight = useGameStore(state => state.setMapHeight);
  const [localWidth, setLocalWidth] = useState(mapWidth);
  const [localHeight, setLocalHeight] = useState(mapHeight);
  const [localPlayers, setLocalPlayers] = useState(playersCount);
  const [localLayout, setLocalLayout] = useState(mapLayout);

  useEffect(() => setLocalWidth(mapWidth), [mapWidth]);
  useEffect(() => setLocalHeight(mapHeight), [mapHeight]);
  useEffect(() => setLocalPlayers(playersCount), [playersCount]);
  useEffect(() => setLocalLayout(mapLayout), [mapLayout]);

  const applyChanges = () => {
    setMapWidth(localWidth);
    setMapHeight(localHeight);
    setPlayersCount(localPlayers);
    setMapLayout(localLayout);
  };
  return (
    <div style={{ padding: 10, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <button onClick={nextTurn}>End Turn</button>
      <span>Current Turn: {currentTurn}</span>
      <button onClick={zoomOut}>-</button>
      <span>Zoom: {cellSize}px</span>
      <button onClick={zoomIn}>+</button>
      <span>Width:</span>
      <input type="number" value={localWidth} onChange={e => setLocalWidth(Number(e.target.value))} />
      <span>Height:</span>
      <input type="number" value={localHeight} onChange={e => setLocalHeight(Number(e.target.value))} />
      <span>Players:</span>
      <input type="number" min={1} value={localPlayers} onChange={e => setLocalPlayers(Number(e.target.value))} />
      <span>Layout:</span>
      <select value={localLayout} onChange={e => setLocalLayout(e.target.value as TerrainLayout)}>
        <option value="random">Random</option>
        <option value="continents">Continents</option>
        <option value="islands">Islands</option>
        <option value="panagea">Panagea</option>
        <option value="inlandSea">Inland Sea</option>
        <option value="lakes">Lakes</option>
      </select>
      <button onClick={applyChanges}>Apply</button>
    </div>
  );
};

export default Controls;

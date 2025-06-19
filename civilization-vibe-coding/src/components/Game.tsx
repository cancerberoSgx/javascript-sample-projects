import React from 'react';
import Controls from './Controls';
import Map from './Map';

const Game: React.FC = () => (
  <div style={{ position: 'relative', height: '100%' }}>
    <Controls />
    <Map />
  </div>
);

export default Game;

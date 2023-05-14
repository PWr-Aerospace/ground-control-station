import React from 'react';
import { Map, TileLayer } from 'react-offline-map';

interface MapProps {
  latitude: number;
  longitude: number;
}

const MapComponent: React.FC<MapProps> = ({ latitude, longitude }) => {
  return (
    <Map
      center={[latitude, longitude]}
      zoom={12}
      style={{ height: '400px', width: '100%' }}
    >
      <TileLayer />
    </Map>
  );
};

export default MapComponent;

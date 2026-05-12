import { useEffect } from "react";
import { useMap } from "react-leaflet";

function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.panTo([position.lat, position.lng], { animate: true });
    }
  }, [position, map]);
  return null;
}

export default RecenterMap;

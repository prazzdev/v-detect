// src/App.jsx
import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getDistance } from "geolib";
import { useGPS } from "./hooks/useGPS";
import RegistrationForm from "./components/RegistrationForm";
import { supabase } from "./lib/supabaseClient";
import { APP_SETTINGS } from "./config/appConfig";

// Membuat Custom Icon untuk Mobil dan Motor
const createIcon = (type, color = "blue") =>
  L.divIcon({
    className: "custom-icon",
    html: `<div style="font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3))">${type === "mobil" ? "🚗" : "🏍️"}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

function App() {
  const { position, error } = useGPS();
  const [userData, setUserData] = useState(null);
  const [otherUsers, setOtherUsers] = useState([]);
  const [lastSentPos, setLastSentPos] = useState({ lat: 0, lng: 0 });

  const RADIUS_WARNING = APP_SETTINGS?.RADIUS_WARNING || 30;

  // Sync ke Supabase (Logika asli Anda tetap terjaga)
  useEffect(() => {
    const sync = async () => {
      if (!position || !userData) return;
      const d = Math.sqrt(
        Math.pow(position.lat - lastSentPos.lat, 2) +
          Math.pow(position.lng - lastSentPos.lng, 2),
      );
      if (d > 0.00002) {
        await supabase.from("active_users").upsert({
          user_id: userData.plateNumber,
          lat: position.lat,
          lng: position.lng,
          vehicle_type: userData.vehicleType,
          last_update: new Date().toISOString(),
        });
        setLastSentPos({ lat: position.lat, lng: position.lng });
      }
    };
    sync();
  }, [position]);

  // Realtime Subscription
  useEffect(() => {
    if (!userData) return;
    const channel = supabase
      .channel("live-map")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "active_users" },
        (p) => {
          if (p.new.user_id === userData.plateNumber) return;
          setOtherUsers((prev) => [
            ...prev.filter((u) => u.user_id !== p.new.user_id),
            p.new,
          ]);
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userData]);

  if (!userData) return <RegistrationForm onRegister={setUserData} />;

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-900">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header Info */}
        <div className="bg-white p-4 rounded-3xl shadow-sm flex justify-between items-center border border-slate-200">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              My Identity
            </p>
            <p className="text-lg font-black font-mono">
              {userData.plateNumber}
            </p>
          </div>
          <div className="text-right">
            <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-full uppercase">
              {userData.vehicleType}
            </span>
          </div>
        </div>

        {/* RADAR MAP SECTION */}
        <div className="bg-white rounded-[2.5rem] p-2 shadow-xl border border-white overflow-hidden h-[350px] relative">
          {position ? (
            <MapContainer
              center={[position.lat, position.lng]}
              zoom={18}
              scrollWheelZoom={false}
              className="h-full w-full rounded-[2rem]"
              zoomControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {/* Posisi Kita */}
              <Marker
                position={[position.lat, position.lng]}
                icon={createIcon(userData.vehicleType)}
              />

              {/* Radius Bahaya Visual */}
              <Circle
                center={[position.lat, position.lng]}
                radius={RADIUS_WARNING}
                pathOptions={{
                  fillColor: "red",
                  color: "red",
                  weight: 1,
                  opacity: 0.3,
                  fillOpacity: 0.1,
                }}
              />

              {/* Posisi Kendaraan Lain */}
              {otherUsers.map((user) => (
                <Marker
                  key={user.user_id}
                  position={[user.lat, user.lng]}
                  icon={createIcon(user.vehicle_type)}
                />
              ))}
            </MapContainer>
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-slate-50 italic text-slate-400 text-sm">
              Mengkalibrasi Radar GPS...
            </div>
          )}

          {/* Overlay Peringatan di Atas Map */}
          <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
            <p className="text-[9px] font-black text-blue-600 uppercase flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></span>
              Live Radar Active
            </p>
          </div>
        </div>

        {/* List Deteksi (Tetap ada sebagai data sekunder) */}
        <div className="grid grid-cols-1 gap-2">
          {otherUsers.map((user) => {
            const distance = position
              ? getDistance(position, {
                  latitude: user.lat,
                  longitude: user.lng,
                })
              : null;
            const isDanger = distance <= RADIUS_WARNING;

            return (
              <div
                key={user.user_id}
                className={`p-4 rounded-2xl border flex justify-between items-center transition-all ${isDanger ? "bg-rose-50 border-rose-200" : "bg-white border-slate-100"}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {user.vehicle_type === "mobil" ? "🚗" : "🏍️"}
                  </span>
                  <p
                    className={`font-mono font-bold text-sm ${isDanger ? "text-rose-700" : "text-slate-700"}`}
                  >
                    {user.user_id}
                  </p>
                </div>
                <p
                  className={`font-black ${isDanger ? "text-rose-600 animate-pulse" : "text-slate-400"}`}
                >
                  {distance}m
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;

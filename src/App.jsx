// src/App.jsx
import React, { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getDistance } from "geolib";
import { useGPS } from "./hooks/useGPS";
import RegistrationForm from "./components/RegistrationForm";
import { supabase } from "./lib/supabaseClient";
import { APP_SETTINGS } from "./config/appConfig";

const createIcon = (type) =>
  L.divIcon({
    className: "custom-icon",
    html: `<div style="font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3))">${type === "mobil" ? "🚗" : "🏍️"}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

function App() {
  const { position } = useGPS();
  const [userData, setUserData] = useState(null);
  const [otherUsers, setOtherUsers] = useState([]);
  const [lastSentPos, setLastSentPos] = useState({ lat: 0, lng: 0 });

  const RADIUS_WARNING = APP_SETTINGS?.RADIUS_WARNING || 30;

  // Fungsi helper untuk update list user agar tidak duplikat
  const updateUsersList = useCallback((newUser) => {
    setOtherUsers((prev) => {
      const filtered = prev.filter((u) => u.user_id !== newUser.user_id);
      return [...filtered, newUser];
    });
  }, []);

  // 1. Sync Lokasi Kita (Upsert)
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
  }, [position, userData, lastSentPos]);

  // 2. Fetch Data Awal & Realtime Listener
  useEffect(() => {
    if (!userData) return;

    // AMBIL SEMUA DATA YANG ADA DI DATABASE SAAT INI
    const loadData = async () => {
      const { data, error } = await supabase
        .from("active_users")
        .select("*")
        .neq("user_id", userData.plateNumber); // Kecuali diri sendiri

      if (error) {
        console.error("Gagal mengambil data awal:", error);
      } else if (data) {
        setOtherUsers(data);
      }
    };

    loadData();

    // LISTEN PERUBAHAN SELANJUTNYA
    const channel = supabase
      .channel("live-traffic")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "active_users" },
        (p) => {
          if (p.eventType === "DELETE") {
            setOtherUsers((prev) =>
              prev.filter((u) => u.user_id !== p.old.user_id),
            );
          } else {
            const incoming = p.new;
            if (incoming.user_id !== userData.plateNumber) {
              updateUsersList(incoming);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userData, updateUsersList]);

  if (!userData) return <RegistrationForm onRegister={setUserData} />;

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-900">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header Identity */}
        <div className="bg-white p-4 rounded-3xl shadow-sm flex justify-between items-center border border-slate-200">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">
              Identity
            </p>
            <p className="text-lg font-black font-mono">
              {userData.plateNumber}
            </p>
          </div>
          <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-full uppercase">
            {userData.vehicleType}
          </span>
        </div>

        {/* RADAR MAP */}
        <div className="bg-white rounded-[2.5rem] p-2 shadow-xl border border-white overflow-hidden h-[350px] relative">
          {position ? (
            <MapContainer
              center={[position.lat, position.lng]}
              zoom={18}
              className="h-full w-full rounded-[2rem]"
              zoomControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {/* Marker Kita */}
              <Marker
                position={[position.lat, position.lng]}
                icon={createIcon(userData.vehicleType)}
              />

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

              {/* Marker Orang Lain */}
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
              Mencari Sinyal GPS...
            </div>
          )}
        </div>

        {/* List Kendaraan */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase px-2">
            Nearby Vehicles
          </h3>
          {otherUsers.length > 0 ? (
            otherUsers.map((user) => {
              const distance = position
                ? getDistance(position, {
                    latitude: user.lat,
                    longitude: user.lng,
                  })
                : null;
              const isDanger = distance !== null && distance <= RADIUS_WARNING;

              return (
                <div
                  key={user.user_id}
                  className={`p-4 rounded-2xl border flex justify-between items-center transition-all ${
                    isDanger
                      ? "bg-rose-50 border-rose-200"
                      : "bg-white border-slate-100"
                  }`}
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
            })
          ) : (
            <div className="text-center py-8 bg-white/50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-400 italic">
                Radar sepi, tidak ada kendaraan lain...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

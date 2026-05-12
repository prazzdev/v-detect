// src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getDistance } from "geolib";
import { useGPS } from "./hooks/useGPS";
import RegistrationForm from "./components/RegistrationForm";
import { supabase } from "./lib/supabaseClient";
import { APP_SETTINGS } from "./config/appConfig";
import { useWakeLock } from "./hooks/useWakeLock";
import { useOrientationLock } from "./hooks/useOrientationLock";

const createIcon = (type) =>
  L.divIcon({
    className: "custom-icon",
    html: `<div style="font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3))">${type === "mobil" ? "🚗" : "🏍️"}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

function App() {
  const { position } = useGPS();
  const isWakeLockActive = useWakeLock();
  useOrientationLock();

  const [userData, setUserData] = useState(null);
  const [otherUsers, setOtherUsers] = useState([]);
  const [lastSentPos, setLastSentPos] = useState({ lat: 0, lng: 0 });
  const [isWarningActive, setIsWarningActive] = useState(false);

  const audioRef = useRef(
    new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg"),
  );
  const RADIUS_WARNING = APP_SETTINGS?.RADIUS_WARNING || 30;

  // Fungsi Peringatan (Suara + Getar)
  const playWarningEffects = useCallback(() => {
    // 1. Putar Suara
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});

    // 2. Trigger Getar (Hanya jika didukung perangkat)
    if ("vibrate" in navigator) {
      navigator.vibrate(200); // Bergetar selama 200ms
    }
  }, []);

  const updateUsersList = useCallback((newUser) => {
    setOtherUsers((prev) => {
      const index = prev.findIndex((u) => u.user_id === newUser.user_id);
      if (index !== -1) {
        const oldUser = prev[index];
        if (oldUser.lat === newUser.lat && oldUser.lng === newUser.lng)
          return prev;

        const newList = [...prev];
        newList[index] = newUser;
        return newList;
      }
      return [...prev, newUser];
    });
  }, []);

  // 1. Sync Lokasi (Disesuaikan agar tidak terlalu sensitif terhadap noise)
  useEffect(() => {
    const sync = async () => {
      if (!position || !userData) return;
      const d = Math.sqrt(
        Math.pow(position.lat - lastSentPos.lat, 2) +
          Math.pow(position.lng - lastSentPos.lng, 2),
      );

      // Ambang batas ditingkatkan menjadi 0.00005 (~5-6 meter)
      // untuk mencegah pemborosan database akibat noise sensor.
      if (d > 0.00005) {
        await supabase.from("active_users").upsert({
          user_id: userData.plateNumber.toUpperCase(),
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

  // 2. Realtime Subscription
  useEffect(() => {
    if (!userData) return;

    const loadData = async () => {
      const { data } = await supabase
        .from("active_users")
        .select("*")
        .neq("user_id", userData.plateNumber.toUpperCase());
      if (data) setOtherUsers(data);
    };

    loadData();

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
            if (p.new.user_id !== userData.plateNumber.toUpperCase())
              updateUsersList(p.new);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userData, updateUsersList]);

  // 3. Warning Logic
  useEffect(() => {
    if (!position || otherUsers.length === 0) {
      setIsWarningActive(false);
      return;
    }

    const distances = otherUsers.map((u) =>
      getDistance(position, { latitude: u.lat, longitude: u.lng }),
    );
    const minDistance = Math.min(...distances);

    if (minDistance <= RADIUS_WARNING) {
      setIsWarningActive(true);
      const intervalTime = minDistance <= 10 ? 300 : 800;
      const warningInterval = setInterval(
        () => playWarningEffects(),
        intervalTime,
      );
      return () => clearInterval(warningInterval);
    } else {
      setIsWarningActive(false);
    }
  }, [position, otherUsers, RADIUS_WARNING, playWarningEffects]);

  // 4. Tab Close Cleanup
  useEffect(() => {
    const handleTabClose = () => {
      if (userData) {
        const { plateNumber } = userData;
        const blob = new Blob(
          [JSON.stringify({ user_id: plateNumber.toUpperCase() })],
          { type: "application/json" },
        );
      }
    };

    window.addEventListener("beforeunload", handleTabClose);
    return () => window.removeEventListener("beforeunload", handleTabClose);
  }, [userData]);

  if (!userData) return <RegistrationForm onRegister={setUserData} />;

  return (
    <div
      className={`min-h-screen transition-colors duration-500 ${isWarningActive ? "bg-red-50" : "bg-slate-50"} p-4 font-sans text-slate-900`}
    >
      <div className="max-w-lg mx-auto space-y-4">
        {/* Status Bar Indikator Wake Lock */}
        <div className="flex justify-end px-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black tracking-tighter ${isWakeLockActive ? "bg-green-100 text-green-600" : "bg-slate-200 text-slate-500"}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isWakeLockActive ? "bg-green-500 animate-pulse" : "bg-slate-400"}`}
            ></span>
            {isWakeLockActive ? "SCREEN ALWAYS ON" : "SCREEN AUTO-SLEEP"}
          </div>
        </div>

        {/* Warning Banner */}
        <div
          className={`overflow-hidden transition-all duration-500 ${isWarningActive ? "max-h-20 opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="bg-red-600 text-white p-3 rounded-2xl animate-pulse text-center font-black text-xs tracking-widest shadow-lg shadow-red-200">
            ⚠️ JARAK BERBAHAYA!
          </div>
        </div>

        {/* Identity Card */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl">
              {userData.vehicleType === "mobil" ? "🚗" : "🏍️"}
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-600 uppercase leading-none mb-1">
                {userData.vehicleType === "mobil" ? "MOBIL" : "MOTOR"}
              </p>
              <p className="font-black font-mono text-slate-700 text-lg">
                {userData.plateNumber.toUpperCase()}
              </p>
            </div>
          </div>
          <button
            onClick={playWarningEffects}
            className="p-2 bg-slate-100 rounded-xl hover:bg-blue-50 transition-colors"
          >
            🔊
          </button>
        </div>

        {/* MAP RADAR */}
        <div className="bg-white rounded-[2.5rem] p-2 shadow-xl border border-white h-[380px] relative overflow-hidden">
          {position ? (
            <MapContainer
              center={[position.lat, position.lng]}
              zoom={18}
              className="h-full w-full rounded-[2rem]"
              zoomControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
                  opacity: 0.2,
                  fillOpacity: 0.05,
                }}
              />
              {otherUsers.map((user) => (
                <Marker
                  key={user.user_id}
                  position={[user.lat, user.lng]}
                  icon={createIcon(user.vehicle_type)}
                />
              ))}
            </MapContainer>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 gap-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-slate-400 animate-pulse">
                MENGHUBUNGKAN SATELIT...
              </p>
            </div>
          )}
        </div>

        {/* List Vehicles Section */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-black text-slate-400 px-2 tracking-[0.2em]">
            KENDARAAN TERDEKAT
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {otherUsers.length === 0 ? (
              <p className="text-center py-4 text-xs text-slate-400 italic bg-white/40 rounded-2xl border border-dashed border-slate-200">
                Tidak ada kendaraan di sekitar
              </p>
            ) : (
              otherUsers.map((user) => {
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
                    className={`p-4 rounded-2xl border flex justify-between items-center transition-all duration-500 ${isDanger ? "bg-white border-red-200 shadow-md shadow-red-50" : "bg-white/60 border-slate-100"}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xl p-2 rounded-xl ${isDanger ? "bg-red-100" : "bg-slate-100"}`}
                      >
                        {user.vehicle_type === "mobil" ? "🚗" : "🏍️"}
                      </span>
                      <p
                        className={`font-mono font-bold text-sm ${isDanger ? "text-red-600" : "text-slate-600"}`}
                      >
                        {user.user_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-black tracking-tighter ${isDanger ? "text-red-600" : "text-blue-600"}`}
                      >
                        {distance} <span className="text-[10px]">M</span>
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

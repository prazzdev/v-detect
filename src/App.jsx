import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMap,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getDistance, getRhumbLineBearing } from "geolib";
import { useGPS } from "./hooks/useGPS";
import RegistrationForm from "./components/RegistrationForm";
import { supabase } from "./lib/supabaseClient";
import { APP_SETTINGS } from "./config/appConfig";
import { useWakeLock } from "./hooks/useWakeLock";
import { useOrientationLock } from "./hooks/useOrientationLock";

// const createIcon = (type, rotation = 0) =>
//   L.divIcon({
//     className: "custom-icon",
//     html: `<div style="font-size: 24px; transition: transform 0.3s ease; transform: rotate(${rotation}deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3))">${type === "mobil" ? "🚗" : "🏍️"}</div>`,
//     iconSize: [30, 30],
//     iconAnchor: [15, 15],
//   });
const createIcon = (type, rotation = 0, label = "") =>
  L.divIcon({
    className: "custom-icon",
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
        <div style="
          background: rgba(255, 255, 255, 0.9);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid #cbd5e1;
          font-family: monospace;
          font-weight: 900;
          font-size: 10px;
          color: #1e293b;
          white-space: nowrap;
          margin-bottom: 2px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        ">
          ${label}
        </div>
        <div style="
          font-size: 24px;
          transition: transform 0.3s ease;
          transform: rotate(${rotation}deg);
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        ">
          ${type === "mobil" ? "🚗" : "🏍️"}
        </div>
      </div>`,
    iconSize: [0, 0], // Ukuran 0 agar titik jangkar (anchor) berada tepat di tengah konten flex
    iconAnchor: [0, 0],
  });

function RecenterMap({ position, isFollowUser, isDrivingMode, heading }) {
  const map = useMap();

  useEffect(() => {
    if (position && isFollowUser) {
      const targetZoom = isDrivingMode ? 19 : 17;
      map.setView([position.lat, position.lng], targetZoom, { animate: true });
    }
  }, [position, isFollowUser, isDrivingMode, map]);

  return null;
}

function App() {
  const { position } = useGPS();
  const isWakeLockActive = useWakeLock();
  useOrientationLock();

  const [userData, setUserData] = useState(null);
  const [otherUsers, setOtherUsers] = useState([]);
  const [isFollowUser, setIsFollowUser] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDrivingMode, setIsDrivingMode] = useState(false);
  const [isPowerSaving, setIsPowerSaving] = useState(false);

  // State baru untuk UI Map
  const [isSatellite, setIsSatellite] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const appRef = useRef(null); // Ref untuk fullscreen kontainer

  const [lastSentPos, setLastSentPos] = useState({
    lat: 0,
    lng: 0,
    timestamp: 0,
    heading: 0,
  });

  const userHeading = useMemo(() => {
    if (position?.heading !== null && position?.heading !== undefined) {
      return position.heading;
    }
    if (lastSentPos.lat !== 0 && position) {
      const bearing = getRhumbLineBearing(
        { latitude: lastSentPos.lat, longitude: lastSentPos.lng },
        { latitude: position.lat, longitude: position.lng },
      );
      return bearing || 0;
    }
    return 0;
  }, [position, lastSentPos]);

  const [isWarningActive, setIsWarningActive] = useState(false);
  const audioRef = useRef(
    new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg"),
  );
  const RADIUS_WARNING = APP_SETTINGS?.RADIUS_WARNING || 30;

  // Toggle Fullscreen Function
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      appRef.current.requestFullscreen().catch((err) => {
        alert(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const playWarningEffects = useCallback(() => {
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
    if ("vibrate" in navigator) navigator.vibrate(200);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const updateUsersList = useCallback((newUser) => {
    setOtherUsers((prev) => {
      const index = prev.findIndex((u) => u.user_id === newUser.user_id);
      if (index !== -1) {
        if (prev[index].lat === newUser.lat && prev[index].lng === newUser.lng)
          return prev;
        const newList = [...prev];
        newList[index] = newUser;
        return newList;
      }
      return [...prev, newUser];
    });
  }, []);

  useEffect(() => {
    const sync = async () => {
      if (!position || !userData || !isOnline) return;
      const now = new Date();
      const timeDiff = (now.getTime() - lastSentPos.timestamp) / 1000;
      const minTime = isPowerSaving ? 60 : 30;
      const minDistance = isPowerSaving ? 0.0001 : 0.00005;

      const d = Math.sqrt(
        Math.pow(position.lat - lastSentPos.lat, 2) +
          Math.pow(position.lng - lastSentPos.lng, 2),
      );

      if (d > minDistance || timeDiff > minTime) {
        await supabase.from("active_users").upsert({
          user_id: userData.plateNumber.toUpperCase(),
          lat: position.lat,
          lng: position.lng,
          vehicle_type: userData.vehicleType,
          last_update: now.toISOString(),
        });
        setLastSentPos({
          lat: position.lat,
          lng: position.lng,
          timestamp: now.getTime(),
        });
      }
    };
    sync();
  }, [position, userData, lastSentPos, isOnline, isPowerSaving]);

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
              prev.filter((u) => u.user_id !== (p.old.user_id || p.old.id)),
            );
          } else if (p.new.user_id !== userData.plateNumber.toUpperCase()) {
            updateUsersList(p.new);
          }
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userData, updateUsersList]);

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

  return (
    <div
      ref={appRef}
      className={`min-h-screen transition-colors duration-500 ${isWarningActive ? "bg-red-50" : "bg-slate-50"} p-4 font-sans text-slate-900 overflow-y-auto`}
    >
      {!userData ? (
        <RegistrationForm onRegister={setUserData} />
      ) : (
        <div className="max-w-lg mx-auto space-y-4 pb-10">
          {/* Status Bar */}
          <div className="flex justify-between items-center px-2">
            <div
              className={`px-3 py-1 rounded-full text-[9px] font-black tracking-tighter ${isOnline ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600 animate-pulse"}`}
            >
              {isOnline ? "● ONLINE" : "○ OFFLINE"}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsPowerSaving(!isPowerSaving)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black tracking-tighter transition-all ${isPowerSaving ? "bg-amber-100 text-amber-600 shadow-sm" : "bg-slate-200 text-slate-500"}`}
              >
                {isPowerSaving ? "🔋 SAVER ON" : "⚡ NORMAL"}
              </button>
              <button
                onClick={toggleFullscreen}
                className="bg-slate-800 text-white px-3 py-1 rounded-full text-[9px] font-black tracking-tighter"
              >
                {isFullscreen ? "EXIT FULL" : "FULLSCREEN"}
              </button>
            </div>

            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black tracking-tighter ${isWakeLockActive ? "bg-green-100 text-green-600" : "bg-slate-200 text-slate-500"}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isWakeLockActive ? "bg-green-500 animate-pulse" : "bg-slate-400"}`}
              ></span>
              {isWakeLockActive ? "AWAKE" : "SLEEP"}
            </div>
          </div>

          {/* Banner Peringatan Offline */}
          {!isOnline && (
            <div className="bg-orange-600 text-white p-2 rounded-2xl text-center font-black text-[10px] tracking-widest shadow-lg">
              KONEKSI TERPUTUS: POSISI TIDAK TERUPDATE
            </div>
          )}

          {/* Banner Bahaya */}
          <div
            className={`overflow-hidden transition-all duration-500 ${isWarningActive ? "max-h-20 opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="bg-red-600 text-white p-3 rounded-2xl animate-pulse text-center font-black text-xs tracking-widest shadow-lg shadow-red-200">
              ⚠️ JARAK BERBAHAYA!
            </div>
          </div>

          {/* Profil Kendaraan */}
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl">
                {userData.vehicleType === "mobil" ? "🚗" : "🏍️"}
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-600 uppercase leading-none mb-1">
                  {userData.vehicleType}
                </p>
                <p className="font-black font-mono text-slate-700 text-lg">
                  {userData.plateNumber.toUpperCase()}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsDrivingMode(!isDrivingMode);
                setIsFollowUser(true);
              }}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all ${isDrivingMode ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-slate-100 text-slate-400"}`}
            >
              <span className="text-lg">{isDrivingMode ? "🧭" : "🗺️"}</span>
              <span className="text-[7px] font-black leading-none mt-1">
                {isDrivingMode ? "DRIVE" : "2D"}
              </span>
            </button>
          </div>

          {/* Map Container */}
          <div
            className={`bg-white rounded-[2.5rem] p-2 shadow-xl border border-white relative overflow-hidden ${isFullscreen ? "h-[70vh]" : "h-[380px]"}`}
          >
            {position ? (
              <div
                className={`h-full w-full transition-transform duration-700 ease-out ${isDrivingMode ? "driving-perspective" : ""}`}
                style={
                  isDrivingMode
                    ? { transform: `rotate(${-userHeading}deg)` }
                    : {}
                }
              >
                <MapContainer
                  center={[position.lat, position.lng]}
                  zoom={17}
                  className="h-full w-full rounded-[2rem]"
                  zoomControl={false}
                >
                  {/* Zoom Control di Atas Kiri */}
                  <ZoomControl position="topleft" />

                  {/* Tile Layer Logic */}
                  <TileLayer
                    url={
                      isSatellite
                        ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    }
                    attribution="&copy; ESRI / OpenStreetMap"
                  />

                  <RecenterMap
                    position={position}
                    isFollowUser={isFollowUser}
                    isDrivingMode={isDrivingMode}
                    heading={userHeading}
                  />

                  <Marker
                    position={[position.lat, position.lng]}
                    icon={createIcon(
                      userData.vehicleType,
                      isDrivingMode ? userHeading : 0,
                      userData.plateNumber.toUpperCase(),
                    )}
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
                      icon={createIcon(
                        user.vehicle_type,
                        isDrivingMode ? userHeading : 0,
                      )}
                    />
                  ))}
                </MapContainer>
              </div>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 gap-3">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-slate-400 animate-pulse">
                  MENGHUBUNGKAN SATELIT...
                </p>
              </div>
            )}

            {/* Toggle Satelit di Kanan Atas dalam Map */}
            <button
              onClick={() => setIsSatellite(!isSatellite)}
              className="absolute top-4 right-4 z-[1000] bg-white/90 p-2 rounded-xl shadow-md border border-slate-200 text-[9px] font-black"
            >
              {isSatellite ? "🗺️ ROAD" : "🛰️ SATELLITE"}
            </button>

            {/* Kontrol Kunci Map */}
            <button
              onClick={() => setIsFollowUser(!isFollowUser)}
              className={`absolute bottom-6 right-6 z-[1000] px-4 py-2 rounded-full shadow-lg font-black text-[10px] tracking-widest border transition-all duration-300 ${isFollowUser ? "bg-blue-600 text-white border-blue-400" : "bg-white text-slate-400 border-slate-200"}`}
            >
              {isFollowUser ? "🔒 LOCKED" : "🔓 FREE"}
            </button>
          </div>

          {/* List Kendaraan */}
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
      )}
    </div>
  );
}

export default App;

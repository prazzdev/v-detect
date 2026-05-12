import { useState, useEffect, useCallback } from "react";

function useWakeLock() {
  const [wakeLock, setWakeLock] = useState(null);

  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        const lock = await navigator.wakeLock.request("screen");
        setWakeLock(lock);
        console.log("Sistem Wake Lock Aktif");
      }
    } catch (err) {
      console.error("Gagal mengaktifkan Wake Lock:", err.message);
    }
  }, []);

  useEffect(() => {
    requestWakeLock();

    // Re-aktifkan jika aplikasi kembali dari background
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [requestWakeLock]);

  return !!wakeLock;
}

export default useWakeLock;

import { useState, useEffect } from "react";
import { APP_SETTINGS } from "../config/appConfig";

export const useGPS = () => {
  const [position, setPosition] = useState(null); // Menyimpan objek lokasi
  const [error, setError] = useState(null); // Menyimpan pesan error jika GPS bermasalah

  useEffect(() => {
    // 1. Cek apakah Browser/HP mendukung fitur Geolocation
    if (!navigator.geolocation) {
      setError("Browser Anda tidak mendukung fitur lokasi (GPS)");
      return;
    }

    // 2. Fungsi yang dipanggil setiap kali koordinat berubah secara real-time
    const handleSuccess = (pos) => {
      const { latitude, longitude, heading, speed } = pos.coords;

      setPosition({
        lat: latitude,
        lng: longitude,
        heading: heading || 0, // Arah hadap kendaraan (0-360 derajat)
        speed: speed || 0, // Kecepatan dalam meter per detik
      });

      // Log ke console untuk memantau pergerakan saat pengembangan
      console.log("Lokasi Terkini:", latitude, longitude, "Arah:", heading);
    };

    // 3. Fungsi jika terjadi error (GPS dimatikan user atau sinyal hilang)
    const handleError = (err) => {
      setError(err.message);
      console.error("GPS Error:", err.message);
    };

    // 4. Mulai mengawasi pergerakan dengan konfigurasi dari APP_SETTINGS
    const watcher = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: APP_SETTINGS.GPS_HIGH_ACCURACY, // Merujuk ke appConfig
        maximumAge: 0, // Tidak menggunakan cache posisi
        timeout: APP_SETTINGS.GPS_TIMEOUT, // Merujuk ke appConfig
      },
    );

    // 5. Bersihkan watcher (stop tracking) jika komponen tidak lagi digunakan (unmount)
    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  return { position, error };
};

// src/config/appConfig.js

export const APP_SETTINGS = {
  // Jarak (dalam meter)
  RADIUS_DETECTION: 100, // Mulai memantau kendaraan lain
  RADIUS_WARNING: 30, // Muncul alert kuning
  RADIUS_DANGER: 10, // Muncul alert merah & saran berhenti

  // Pengaturan GPS
  GPS_INTERVAL: 1000, // Ambil data GPS setiap 1 detik (dalam milidetik)
  GPS_HIGH_ACCURACY: true, // Gunakan akurasi tinggi (GPS vs Network)
  GPS_TIMEOUT: 5000, // Batas waktu tunggu respon GPS

  // Aturan Prioritas (Bisa diubah sesuai kebutuhan)
  PRIORITY_RULES: {
    MAIN_ROAD_FIRST: true,
    LEFT_SIDE_FIRST: true, // Sesuai UU No. 22/2009
    MOTORCYCLE_YIELD: false, // Jika true, motor harus mengalah pada mobil
  },
};

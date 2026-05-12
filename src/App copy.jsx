// src/App.jsx
import React, { useState } from "react";
import { useGPS } from "./hooks/useGPS";
import RegistrationForm from "./components/RegistrationForm";

function App() {
  const { position, error } = useGPS();
  const [userData, setUserData] = useState(null);

  // Jika user belum daftar, tampilkan form
  if (!userData) {
    return <RegistrationForm onRegister={(data) => setUserData(data)} />;
  }

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>V-Detect Active</h1>
      <div
        style={{
          background: "#d4edda",
          padding: "10px",
          borderRadius: "5px",
          marginBottom: "10px",
        }}
      >
        <p>
          User: <b>{userData.plateNumber}</b> ({userData.vehicleType})
        </p>
      </div>

      <hr />

      {error && <div style={{ color: "red" }}>Error: {error}</div>}

      {position ? (
        <div>
          <h3>📍 Koordinat Anda:</h3>
          <p>
            {position.lat}, {position.lng}
          </p>
          <p>Sistem siap mengirim data ke Supabase...</p>
        </div>
      ) : (
        <p>Mencari sinyal GPS...</p>
      )}
    </div>
  );
}

export default App;

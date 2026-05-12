import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import RadarPage from "./pages/RadarPage";
import AdminMapping from "./pages/AdminMapping";

function App() {
  return (
    <Router>
      <Routes>
        {/* Halaman Radar Utama untuk User */}
        <Route path="/" element={<RadarPage />} />

        {/* Halaman Khusus Admin untuk Mapping Persimpangan */}
        <Route path="/vdetect" element={<AdminMapping />} />

        {/* Fallback kembali ke radar */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;

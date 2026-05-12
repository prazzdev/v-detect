import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import { supabase } from "../lib/supabaseClient";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Icon Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => onMapClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
};

export const AdminMapping = () => {
  const [intersections, setIntersections] = useState([]);
  const [selectedCoord, setSelectedCoord] = useState(null);
  const [loading, setLoading] = useState(true);

  // Koordinat Pusat Banjarnegara
  const centerBanjarnegara = [-7.3964771663050835, 109.6992772362941];

  useEffect(() => {
    fetchIntersections();
  }, []);

  const fetchIntersections = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("intersections").select("*");
    if (error) console.error("Error fetching:", error);
    else setIntersections(data || []);
    setLoading(false);
  };

  const saveIntersection = async (e) => {
    e.preventDefault();
    const name = e.target.intersectionName.value;

    if (name && selectedCoord) {
      const { data, error } = await supabase
        .from("intersections")
        .insert([{ name, lat: selectedCoord.lat, lng: selectedCoord.lng }])
        .select();

      if (error) {
        alert("Gagal menyimpan data.");
      } else {
        setIntersections([...intersections, ...data]);
        setSelectedCoord(null);
      }
    }
  };

  const deleteIntersection = async (id) => {
    if (window.confirm("Hapus titik persimpangan ini?")) {
      const { error } = await supabase
        .from("intersections")
        .delete()
        .eq("id", id);
      if (!error) {
        setIntersections(intersections.filter((item) => item.id !== id));
      }
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          padding: "15px 25px",
          background: "white",
          borderBottom: "1px solid #ddd",
          zIndex: 1000,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "1.1rem",
            fontWeight: "600",
            color: "#333",
          }}
        >
          Manajemen Titik Persimpangan
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "0.75rem",
            color: loading ? "#0056b3" : "#28a745",
          }}
        >
          {loading
            ? "Sinkronisasi database..."
            : `Terhubung: ${intersections.length} lokasi terdaftar`}
        </p>
      </div>

      <MapContainer center={centerBanjarnegara} zoom={15} style={{ flex: 1 }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <MapClickHandler
          onMapClick={(lat, lng) => setSelectedCoord({ lat, lng })}
        />

        {intersections.map((point) => (
          <Marker key={point.id} position={[point.lat, point.lng]}>
            <Popup>
              <div style={{ padding: "5px" }}>
                <strong style={{ fontSize: "0.9rem" }}>{point.name}</strong>
                <hr
                  style={{
                    margin: "8px 0",
                    border: "0",
                    borderTop: "1px solid #eee",
                  }}
                />
                <button
                  onClick={() => deleteIntersection(point.id)}
                  style={{
                    color: "#dc3545",
                    border: "1px solid #dc3545",
                    background: "none",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    width: "100%",
                  }}
                >
                  Hapus Lokasi
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {selectedCoord && (
          <Marker position={[selectedCoord.lat, selectedCoord.lng]}>
            <Popup>
              <form
                onSubmit={saveIntersection}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  padding: "5px",
                }}
              >
                <label style={{ fontSize: "0.75rem", fontWeight: "600" }}>
                  Nama Lokasi
                </label>
                <input
                  name="intersectionName"
                  placeholder="Misal: Perempatan Polres"
                  required
                  autoFocus
                  style={{
                    padding: "6px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    backgroundColor: "#1a73e8",
                    color: "white",
                    border: "none",
                    padding: "8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "500",
                  }}
                >
                  Simpan Lokasi
                </button>
              </form>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default AdminMapping;

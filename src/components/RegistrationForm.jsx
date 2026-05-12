// src/components/RegistrationForm.jsx
import React, { useState } from "react";
import Tesseract from "tesseract.js";

const RegistrationForm = ({ onRegister }) => {
  const [vehicleType, setVehicleType] = useState("motor");
  const [plateNumber, setPlateNumber] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPreviewImage(URL.createObjectURL(file));
    setIsScanning(true);

    try {
      const {
        data: { text },
      } = await Tesseract.recognize(file, "eng", {
        logger: (m) =>
          console.log(m.status + ": " + Math.round(m.progress * 100) + "%"),
      });

      const cleanedText = text.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      setPlateNumber(cleanedText);
    } catch (error) {
      console.error("Gagal membaca plat nomor:", error);
      alert("Gagal membaca gambar, silakan input manual.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!plateNumber || plateNumber.length < 3) {
      return alert("Harap isi plat nomor dengan benar!");
    }

    onRegister({
      vehicleType,
      plateNumber: plateNumber.trim(),
      registeredAt: new Date().toISOString(),
    });
  };

  return (
    <div className="max-w-[400px] mx-auto my-10 p-5 border border-gray-200 rounded-xl shadow-lg bg-white">
      <h2 className="text-center text-2xl font-bold text-gray-800">
        Pendaftaran Pengendara
      </h2>
      <p className="text-xs text-gray-500 text-center mt-1 mb-6">
        Data ini digunakan untuk identifikasi di persimpangan.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Input Group: Jenis Kendaraan */}
        <div className="flex flex-col">
          <label className="text-sm font-semibold text-gray-700 mb-1">
            Jenis Kendaraan:
          </label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-base"
          >
            <option value="motor">Sepeda Motor</option>
            <option value="mobil">Mobil</option>
          </select>
        </div>

        {/* Input Group: Foto Plat */}
        <div className="flex flex-col">
          <label className="text-sm font-semibold text-gray-700 mb-1">
            Foto Plat Nomor:
          </label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageChange}
            className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor:pointer"
          />
        </div>

        {/* Preview Image & Overlay */}
        {previewImage && (
          <div className="relative rounded-lg overflow-hidden border border-gray-100">
            <img src={previewImage} alt="Preview" className="w-full h-auto" />
            {isScanning && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center font-bold text-blue-600 animate-pulse">
                Scanning...
              </div>
            )}
          </div>
        )}

        {/* Input Group: Nomor Plat */}
        <div className="flex flex-col">
          <label className="text-sm font-semibold text-gray-700 mb-1">
            Nomor Plat (Konfirmasi):
          </label>
          <input
            type="text"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
            placeholder="Contoh: AB1234CD"
            disabled={isScanning}
            className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-base disabled:bg-gray-100 font-mono tracking-widest uppercase"
          />
        </div>

        <button
          type="submit"
          disabled={isScanning}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-base transition-colors duration-200 disabled:bg-gray-400"
        >
          {isScanning ? "Memproses Plat..." : "Mulai Berkendara"}
        </button>
      </form>
    </div>
  );
};

export default RegistrationForm;

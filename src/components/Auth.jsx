import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Mail,
  Lock,
  User,
  CreditCard,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";

export const Auth = ({ onAuthSuccess }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    plate_number: "",
    vehicle_type: "motor",
  });

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRegister) {
        // 1. Sign Up ke Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp(
          {
            email: formData.email,
            password: formData.password,
          },
        );

        if (authError) throw authError;

        // 2. Masukkan data ke tabel profiles
        const { error: profileError } = await supabase.from("profiles").insert([
          {
            id: authData.user.id,
            full_name: formData.full_name,
            plate_number: formData.plate_number.toUpperCase(),
            vehicle_type: formData.vehicle_type,
          },
        ]);

        if (profileError) throw profileError;
        alert(
          "Registrasi Berhasil! Silakan cek email untuk verifikasi (jika diaktifkan).",
        );
      } else {
        // Login
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
      }
      onAuthSuccess();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl border border-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-blue-100 border border-slate-50 overflow-hidden">
            <img
              src="/android-chrome-192x192.png"
              alt="Radar Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            {isRegister ? "BUAT AKUN PINTAS" : "SELAMAT DATANG DI PINTAS"}
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 tracking-widest uppercase">
            Sistem Persimpangan Pintar Terawasi
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {/* Email Field */}
          <div className="relative">
            <Mail
              className="absolute left-4 top-3.5 text-slate-400"
              size={18}
            />
            <input
              type="email"
              placeholder="Email"
              className="w-full bg-white border border-slate-100 py-3.5 pl-12 pr-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
            />
          </div>

          {/* Password Field */}
          <div className="relative">
            <Lock
              className="absolute left-4 top-3.5 text-slate-400"
              size={18}
            />
            <input
              type={showPassword ? "text" : "password"} // Dinamis berdasarkan state
              placeholder="Password"
              className="w-full bg-white border border-slate-100 py-3.5 pl-12 pr-12 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
            />
            {/* Tombol Mata */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-3.5 text-slate-400 hover:text-blue-600 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {isRegister && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="relative">
                <User
                  className="absolute left-4 top-3.5 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Nama Lengkap"
                  className="w-full bg-white border border-slate-100 py-3.5 pl-12 pr-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="relative">
                <CreditCard
                  className="absolute left-4 top-3.5 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Plat Nomor (Contoh: R1234XX)"
                  className="w-full bg-white border border-slate-100 py-3.5 pl-12 pr-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                  onChange={(e) =>
                    setFormData({ ...formData, plate_number: e.target.value })
                  }
                  required
                />
              </div>

              <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                {["motor", "mobil"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, vehicle_type: type })
                    }
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.vehicle_type === type ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            disabled={loading}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs tracking-[0.2em] shadow-xl shadow-slate-200 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            {loading
              ? "MEMPROSES..."
              : isRegister
                ? "DAFTAR SEKARANG"
                : "MASUK KE SISTEM"}
            <ChevronRight size={16} />
          </button>
        </form>

        <button
          onClick={() => setIsRegister(!isRegister)}
          className="w-full mt-6 text-[10px] font-black text-slate-400 tracking-widest uppercase hover:text-blue-600 transition-colors"
        >
          {isRegister ? "Sudah punya akun? Login" : "Belum punya akun? Daftar"}
        </button>
      </div>
    </div>
  );
};

export default Auth;

import { useEffect } from "react";

function useOrientationLock() {
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        // Cek apakah Screen Orientation API didukung
        if (
          window.screen &&
          window.screen.orientation &&
          window.screen.orientation.lock
        ) {
          await window.screen.orientation.lock("portrait");
          console.log("Orientation locked to Portrait");
        }
      } catch (err) {
        console.error("Gagal mengunci orientasi:", err.message);
      }
    };

    lockOrientation();

    // Tidak perlu unlock saat unmount agar tetap portrait selama sesi berkendara
  }, []);
}

export default useOrientationLock;

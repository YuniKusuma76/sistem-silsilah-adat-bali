import RelasiKrama from "../models/relasi.model.js";
import { ambilRelasiAnak } from "../helpers/relasi-anak.helper.js";

// Menghitung urutan lahir anak berdasarkan tanggal lahir
export const hitungUrutanLahir = async ({
  mode,
  ayah_id = null,
  ibu_id = null,
  kepala_keluarga_id = null
}, t = null) => {
  // Mengambil relasi anak menggunakan halper
  const relasi = await ambilRelasiAnak({
    mode,
    ayah_id,
    ibu_id,
    kepala_keluarga_id
  }, t);

  if (!relasi || relasi.length === 0) return;

  // Loop urutan lahir
  await Promise.all(
    relasi.map((item, i) => {
      const urutanSeharusnya = i + 1;
      if (item.urutan_lahir !== urutanSeharusnya) {
        return RelasiKrama.update(
          { urutan_lahir: urutanSeharusnya },
          { 
            where: { id: item.id }, 
            transaction: t 
          }
        );
      }
      return Promise.resolve();
    })
  );
};
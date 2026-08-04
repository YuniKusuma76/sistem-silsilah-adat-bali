import RelasiKrama from "../models/relasi.model.js";
import { ambilRelasiAnak } from "../helpers/relasi-anak.helper.js";

// Menghitung urutan lahir anak berdasarkan tanggal lahir
export const hitungUrutanLahir = async ({
  mode,
  ayah_id = null,
  ibu_id = null,
  kepala_keluarga_id = null,
  sertakanDraft = false
}, t = null) => {
  const daftarRelasi = await ambilRelasiAnak({
    mode,
    ayah_id,
    ibu_id,
    kepala_keluarga_id,
    sertakanDraft
  }, t);
  if (!daftarRelasi || daftarRelasi.length === 0) return;

  for (let i = 0; i < daftarRelasi.length; i++) {
    const item = daftarRelasi[i];
    const urutanOtomatis = i + 1;

    const urutanFinal = item.urutan_lahir !== null && item.urutan_lahir !== undefined
      ? Number(item.urutan_lahir)
      : urutanOtomatis;

    if (Number(item.urutan_lahir) !== urutanFinal) {
      await RelasiKrama.update({
        urutan_lahir: urutanFinal 
      },{ 
        where: { id: item.id }, 
        transaction: t 
      });
      item.urutan_lahir = urutanFinal;
    }
  }
};
import { Keluarga, RiwayatKeluarga } from "../models/associations.js";
import { simpanRiwayatKeluarga } from "./riwayat-keluarga.service.js";
import { cariKeluargaAktif } from "./keluarga.service.js";

const BOBOT_EVENT = {
  "LAHIR": 1, 
  "PENGANGKATAN": 2, 
  "KAWIN": 3, 
  "CERAI": 4
};

export const bentukKeluargaAngkat = async ({
  kepala_keluarga_id,
  anak_id,
  tanggal_pengangkatan,
  dasar_keputusan,
  akhir_masuk_anak = null
}, t = null) => {
  // mencari keluarga yang aktif
  let keluarga = await cariKeluargaAktif({ kepala_keluarga_id, t });

  const keluargaBaru = !keluarga;
  const finalTglPengangkatan = tanggal_pengangkatan || new Date().toISOString();

  if (keluargaBaru) {
    keluarga = await Keluarga.create({
      kepala_keluarga_id: parseInt(kepala_keluarga_id),
      jenis_keluarga: "Keluarga Angkat",
      status_keluarga: "Aktif"
    }, { transaction: t });

    await simpanRiwayatKeluarga({
      krama_id: kepala_keluarga_id,
      keluarga_id: keluarga.id,
      kedudukan: "Kepala Keluarga",
      kategori_event: "PENGANGKATAN",
      bobot_event: BOBOT_EVENT["PENGANGKATAN"],
      dasar_keputusan: dasar_keputusan || "Kedudukan sebagai kepala keluarga diberikan karena krama ini memiliki status purusa di dalam keluarga akibat telah mengangkat anak dalam Adat Bali.",
      event_date: finalTglPengangkatan
    }, t);
  }

  // melihat apakah anak sudah pernah tercatat di keluarga ini
  const riwayatAnak = await RiwayatKeluarga.findOne({
    where: {
      krama_id: parseInt(anak_id),
      keluarga_id: keluarga.id,
      akhir_masuk: null
    },
    transaction: t
  });

  if (!riwayatAnak) {
    await simpanRiwayatKeluarga({
      krama_id: anak_id,
      keluarga_id: keluarga.id,
      kedudukan: "Anggota",
      kategori_event: "PENGANGKATAN",
      bobot_event: BOBOT_EVENT["PENGANGKATAN"],
      dasar_keputusan: dasar_keputusan || "Krama ini masuk ke dalam keluarga karena di angkat sebagai anak secara Adat Bali",
      event_date: finalTglPengangkatan,
      akhir_masuk: akhir_masuk_anak,
      allow_multiple: akhir_masuk_anak ? true : false
    }, t);
  }

  return keluarga;
};

// Menutup keluarga angkat ketika kepala keluarga kawin
// Khusus untuk krama bali yang belum kawin + mengangkat anak
export const tutupKeluargaAngkat = async ({ krama_id, t = null }) => {
  await Keluarga.update(
    { status_keluarga: "Non-Aktif" },
    {
      where: {
        kepala_keluarga_id: parseInt(krama_id),
        status_keluarga: "Aktif",
        jenis_keluarga: "Keluarga Angkat"
      },
      transaction: t
    }
  );
};
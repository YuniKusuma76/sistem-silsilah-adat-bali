import { Op } from "sequelize";
import db from "../config/db.config.js";
import path from "path";
import {
  KramaBali,
  RelasiKrama,
  RiwayatKeluarga,
  Keluarga,
  RiwayatPeranAdat
} from "../models/associations.js";
import { supabase } from "../config/supabase.config.js";
import { buatAnakKandung } from "./anak-kandung.service.js";
import { buatAnakAngkat } from "./anak-angkat.service.js";
import { anakAngkatPasangan } from "./anak-angkat-perkawinan.service.js";
import { integrasiRelasiLeluhur } from "./anak-relasi-leluhur.service.js";
import { eksekusiRollbackRelasi } from "./batal-relasi-krama.service.js";
import { rekonsiliasiKronologiKeluarga } from "../helpers/kronologis-order.helper.js";
import { hitungUrutanLahir } from "./urutan-lahir.service.js";

// Helper: upload berkas ke Storage Supabase
const uploadBerkasRelasi = async (file, statusHubungan = "Anak Kandung", bucketName = "berkas-kelengkapan") => {
  if (!file) return null;

  const isAngkat = statusHubungan === "Anak Angkat";
  const prefix = isAngkat ? "pengangkatan" : "kelahiran";
  const folderPath = isAngkat ? "relasi-krama-angkat" : "relasi-krama-kandung";

  const fileExtension = path.extname(file.originalname).toLowerCase();
  const fileName = `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e9)}${fileExtension}`;
  const filePath = `${folderPath}/${fileName}`;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    throw new Error(`Gagal mengunggah berkas ke Cloud Storage: ${error.message}`);
  }

  return data.path;
};

// Helper: konversi nilai ke number atau null
const toSafeIntOrNull = (value) => {
  if (value === null || value === undefined || value === 'null' || value === 'undefined' || String(value).trim() === '' || isNaN(Number(value))) {
    return null;
  }
  return Number(value);
};

export const prosesUpdateRelasiKrama = async ({
  relasi,
  dataUpdate,
  targetAyahId,
  targetIbuId,
  targetStatusHubungan,
  targetPerkawinanId,
  tglAngkatDateOnly,
  tglAngkatTimestamp,
  anak,
  ayah,
  ibu,
  commonParams,
  file = null
}, t) => {
  let relasiBaru = null;
  const catatanUpdate = dataUpdate?.catatan_update || null;

  if (dataUpdate && 'catatan_update' in dataUpdate) {
    delete dataUpdate.catatan_update;
  }

  const anakIdAktif = relasi.anak_id;
  const userIdAsli = relasi.user_id;
  const teksHapusOtomatis = " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal pengangkatan kosong).";

  let berkasPathFinal = relasi.berkas_kelengkapan || null;

  if (file) {
    const pathUploaded = await uploadBerkasRelasi(file, targetStatusHubungan);
    if (pathUploaded) {
      berkasPathFinal = pathUploaded;
    }
  }

  // EVALUASI PERUBAHAN STRUKTURAL
  const ayahLama = toSafeIntOrNull(relasi.ayah_id);
  const ibuLama = toSafeIntOrNull(relasi.ibu_id);
  const statusLama = relasi.status_hubungan;
  const ayahBaru = toSafeIntOrNull(targetAyahId);
  const ibuBaru = toSafeIntOrNull(targetIbuId);

  const isPerubahanStruktural = ayahBaru !== ayahLama || ibuBaru !== ibuLama || targetStatusHubungan !== relasi.status_hubungan;

  if (isPerubahanStruktural) {
    await eksekusiRollbackRelasi(relasi, t);
    await relasi.destroy({ transaction: t });

    if (statusLama === "Anak Kandung") {
      await hitungUrutanLahir({
        ayah_id: ayahLama,
        ibu_id: ibuLama,
        mode: "CAMPUR"
      }, t);
    } else if (statusLama === "Anak Angkat" && (ayahLama || ibuLama)) {
      await hitungUrutanLahir({
        kepala_keluarga_id: ayahLama || ibuLama,
        mode: "ANGKAT"
      }, t);
    }

    const isLeluhurMode = anak.tipe_data === "Leluhur" || ayah?.tipe_data === "Leluhur" || ibu?.tipe_data === "Leluhur";
    const urutanInputManual = dataUpdate?.urutan_lahir ? Number(dataUpdate.urutan_lahir) : null;

    const servicePayload = { 
      anak_id: anakIdAktif,
      ayah_id: ayahBaru,
      ibu_id: ibuBaru,
      status_hubungan: targetStatusHubungan,
      tanggal_pengangkatan: tglAngkatDateOnly,
      berkas_kelengkapan: berkasPathFinal,
      urutan_lahir: urutanInputManual,
      perkawinan_id: targetPerkawinanId,
      is_verifikasi: false,
      file,
      catatan_update: catatanUpdate,
      ...commonParams,
      user_id: userIdAsli
    };

    if (isLeluhurMode) {
      relasiBaru = await integrasiRelasiLeluhur({ 
        ...servicePayload, 
        ayah, 
        ibu, 
        anak 
      }, t);
    } else {
      if (targetStatusHubungan === "Anak Kandung") {
        if (!targetPerkawinanId) {
          throw { 
            status: 400, 
            message: "Pencatatan anak kandung keturunan wajib menyertakan data perkawinan orang tua!" 
          };
        }
        relasiBaru = await buatAnakKandung(servicePayload, t);
      } else if (targetStatusHubungan === "Anak Angkat") {
        if (targetPerkawinanId) {
          relasiBaru = await anakAngkatPasangan(servicePayload, t);
        } else {
          relasiBaru = await buatAnakAngkat(servicePayload, t);
        }
      }
    }
  } else {
    await relasi.update({
      tanggal_pengangkatan: tglAngkatDateOnly,
      berkas_kelengkapan: berkasPathFinal,
      urutan_lahir: dataUpdate?.urutan_lahir ? Number(dataUpdate.urutan_lahir) : relasi.urutan_lahir,
      ...commonParams,
      user_id: userIdAsli
    }, { transaction: t });

    if (targetStatusHubungan === "Anak Angkat" && tglAngkatTimestamp) {
      const kepalaKeluargaId = targetAyahId || targetIbuId;

      if (kepalaKeluargaId) {
        const isAdopsiPasangan = relasi.ayah_id && relasi.ibu_id;

        const riwayatAnakLama = await RiwayatKeluarga.findOne({
          where: {
            krama_id: anakIdAktif,
            kategori_event: "PENGANGKATAN"
          },
          transaction: t
        });

        if (riwayatAnakLama) {
          const tglLamaMurni = riwayatAnakLama.awal_masuk instanceof Date 
            ? riwayatAnakLama.awal_masuk.toISOString().split('T')[0]
            : riwayatAnakLama.awal_masuk.split('T')[0];

          const awalHariLama = new Date(`${tglLamaMurni}T00:00:00.000Z`);
          const akhirHariLama = new Date(`${tglLamaMurni}T23:59:59.999Z`);

          const keluargaTarget = await Keluarga.findOne({
            where: {
              kepala_keluarga_id: parseInt(kepalaKeluargaId),
              jenis_keluarga: "Keluarga Angkat"
            },
            transaction: t
          });

          if (keluargaTarget) {
            await keluargaTarget.update({
              dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusOtomatis, '')
            }, { transaction: t });
          }

          // JALUR A: ORANG TUA TUNGGAL
          if (!isAdopsiPasangan) {
            if (keluargaTarget) {
              await RiwayatKeluarga.update({ 
                awal_masuk: new Date(tglAngkatTimestamp),
                dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusOtomatis, '')
              },{
                where: {
                  krama_id: parseInt(kepalaKeluargaId),
                  keluarga_id: keluargaTarget.id,
                  kedudukan: "Kepala Keluarga",
                  awal_masuk: { [Op.between]: [awalHariLama, akhirHariLama] }
                },
                transaction: t
              });
            }

            await RiwayatPeranAdat.update({ 
              mulai_tanggal: new Date(tglAngkatTimestamp),
              dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusOtomatis, '')
            },{ 
              where: { 
                krama_id: parseInt(kepalaKeluargaId), 
                kategori_event: "PENGANGKATAN",
                mulai_tanggal: { [Op.between]: [awalHariLama, akhirHariLama] }
              }, 
              transaction: t 
            });

            await RiwayatPeranAdat.update({ 
              selesai_tanggal: new Date(tglAngkatTimestamp) 
            },{
              where: {
                krama_id: parseInt(kepalaKeluargaId),
                kategori_event: { [Op.in]: ["LAHIR", "PENGANGKATAN"] },
                selesai_tanggal: { [Op.between]: [awalHariLama, akhirHariLama] }
              },
              transaction: t
            });
          }
        }

        await RiwayatKeluarga.update({ 
          awal_masuk: new Date(tglAngkatTimestamp),
          dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusOtomatis, '')
        },{ 
          where: { 
            krama_id: anakIdAktif, 
            kategori_event: "PENGANGKATAN" 
          }, 
          transaction: t 
        });
      }
    }
    relasiBaru = relasi;
  }

  await rekonsiliasiKronologiKeluarga(anakIdAktif, t);
  return relasiBaru;
};
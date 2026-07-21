import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  KramaBali,
  RelasiKrama,
  RiwayatKeluarga,
  Keluarga,
  RiwayatPeranAdat
} from "../models/associations.js";
import { buatAnakKandung } from "./anak-kandung.service.js";
import { buatAnakAngkat } from "./anak-angkat.service.js";
import { anakAngkatPasangan } from "./anak-angkat-perkawinan.service.js";
import { integrasiRelasiLeluhur } from "./anak-relasi-leluhur.service.js";
import { eksekusiRollbackRelasi } from "./batal-relasi-krama.service.js";
import { rekonsiliasiKronologiKeluarga } from "../helpers/kronologis-order.helper.js";

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
  commonParams
}, t) => {
  let relasiBaru = null;

  const anakIdAktif = relasi.anak_id;
  const userIdAsli = relasi.user_id;
  const teksHapusOtomatis = " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal pengangkatan kosong).";

  // EVALUASI PERUBAHAN STRUKTURAL
  const isPerubahanStruktural = 
    (dataUpdate.hasOwnProperty('ayah_id') && dataUpdate.ayah_id !== relasi.ayah_id) || 
    (dataUpdate.hasOwnProperty('ibu_id') && dataUpdate.ibu_id !== relasi.ibu_id) || 
    (dataUpdate.hasOwnProperty('status_hubungan') && dataUpdate.status_hubungan !== relasi.status_hubungan);

  if (isPerubahanStruktural) {
    await eksekusiRollbackRelasi(relasi, t);
    await relasi.destroy({ transaction: t });

    const isLeluhurMode = anak.tipe_data === "Leluhur" || ayah?.tipe_data === "Leluhur" || ibu?.tipe_data === "Leluhur";

    const servicePayload = { 
      anak_id: anakIdAktif,
      ayah_id: targetAyahId,
      ibu_id: targetIbuId,
      status_hubungan: targetStatusHubungan,
      tanggal_pengangkatan: tglAngkatDateOnly,
      urutan_lahir: dataUpdate.urutan_lahir || relasi.urutan_lahir || null,
      perkawinan_id: targetPerkawinanId,
      is_verifikasi: false,
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
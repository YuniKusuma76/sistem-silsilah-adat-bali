import KramaBali from "../models/krama.model.js";
import { getTrehLeluhur } from "../services/silsilah-leluhur.service.js";

export const getTrehBali = async (req, res) => {
  try {
    const { rootId } = req.params;
    const { depth } = req.query;

    const maxDepth = depth ? parseInt(depth, 10) : 10;

    if (rootId && rootId !== "akar") {
      const kramaExist = await KramaBali.findOne({
        where: {
          id: rootId,
          status_verifikasi: "Disetujui"
        }
      });

      if (!kramaExist) {
        return res.status(404).json({
          success: false,
          message: "Data Krama Bali tidak ditemukan."
        });
      }
    }

    const result = await getTrehLeluhur(rootId, maxDepth);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Struktur treh leluhur tidak dapat ditemukan."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Berhasil memuat treh silsilah leluhur!",
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan internal server.",
      server_message: error.message
    });
  }
};
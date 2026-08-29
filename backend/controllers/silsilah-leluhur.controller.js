import KramaBali from "../models/krama.model.js";
import { 
  getTrehLeluhur,
  getListLeluhur
} from "../services/silsilah-leluhur.service.js";

export const getTrehBali = async (req, res) => {
  try {
    const { rootId } = req.params;

    if (!rootId) {
      return res.status(400).json({
        success: false,
        message: "ID Krama wajib disertakan dalam parameter."
      });
    }

    const depthParam = req.query.maxDepth || req.query.depth;
    let maxDepth = parseInt(depthParam, 10);

    if (isNaN(maxDepth) || maxDepth < 1) {
      maxDepth = 2;
    } else if (maxDepth > 10) {
      maxDepth = 10;
    }

    if (rootId !== "akar") {
      const kramaExist = await KramaBali.findOne({
        where: {
          id: rootId,
          tipe_data: "Leluhur",
          status_verifikasi: "Disetujui"
        }
      });

      if (!kramaExist) {
        return res.status(404).json({
          success: false,
          message: "Data Krama Leluhur tidak ditemukan."
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
    console.error("Error in getTrehBali:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan internal server.",
      server_message: error.message
    });
  }
};

export const getLeluhurOptions = async (req, res) => {
  try {
    const result = await getListLeluhur();

    return res.status(200).json({
      success: true,
      message: "Berhasil mengambil daftar leluhur.",
      data: result
    });
  } catch (error) {
    console.error("Error in getLeluhurOptions:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan internal server.",
      server_message: error.message
    });
  }
};
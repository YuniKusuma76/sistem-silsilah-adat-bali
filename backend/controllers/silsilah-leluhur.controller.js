import KramaBali from "../models/krama.model.js";
import { 
  getTrehLeluhur,
  findAkarLeluhurId
} from "../services/silsilah-leluhur.service.js";

export const getTrehBali = async (req, res) => {
  try {
    let { rootId } = req.params;

    const { depth } = req.query;
    const maxDepth = depth ? parseInt(depth, 10) : 3;

    // Validasi input depth jika yang dikirim bukan angka yang valid
    if (isNaN(maxDepth) || maxDepth <= 0) {
      return res.status(400).json({
        message: "Parameter kedalaman (depth) harus berupa angka positif."
      });
    }

    // Mencari ID yang menjadi akar data leluhur
    if (rootId === "akar") {
      const actualAkarId = await findAkarLeluhurId();
      if (!actualAkarId) {
        return res.status(404).json({
          message: "Data leluhur tertua tidak ditemukan."
        });
      }
      rootId = actualAkarId;
    }

    // Memastikan ID yang diminta memang seorang leluhur
    const isLeluhur = await KramaBali.findOne({
      where: {
        id: rootId,
        tipe_data: "Leluhur",
        status_verifikasi: "Disetujui"
      }
    });

    if (!isLeluhur) {
      return res.status(404).json({
        message: "Data leluhur tidak ditemukan."
      });
    }

    const result = await getTrehLeluhur(rootId, maxDepth);

    return res.status(200).json({
      message: "Berhasil membuat treh bali!",
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};
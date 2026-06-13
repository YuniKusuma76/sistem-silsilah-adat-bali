import { getPuncakSilsilahService } from "../services/silsilah-puncak.service.js";

export const getTrehBaliPuncak = async (req, res) => {
  try {
    const { rootId } = req.params;
    const { depth } = req.query;

    const maxDepth = depth ? parseInt(depth, 10) : 3;
    const targetId = (rootId === "akar" || !rootId) ? null : rootId;
    
    const result = await getPuncakSilsilahService(targetId, maxDepth);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Struktur silsilah tidak dapat ditemukan untuk target ini."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Berhasil memuat silsilah puncak.",
      data: result
    });
  } catch (error) {
    console.error(`[ERROR SILSILAH]: ${error.message}`); 
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan internal server.",
      server_message: error.message
    });
  }
};
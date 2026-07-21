import { getSilsilahPurusaTree } from "../services/silsilah-adat-bali.service.js";

export const getSilsilahTree = async (req, res) => {
  try {
    const { kramaId } = req.params;
    const maxDepth = req.query.maxDepth ? parseInt(req.query.maxDepth) : 4;

    const currentUser = req.userId ? {
      id: req.userId,
      role: req.role
    } : null;

    if (!kramaId) {
      return res.status(400).json({
        success: false,
        message: "ID Krama wajib disertakan dalam parameter."
      });
    }

    const result = await getSilsilahPurusaTree(kramaId, currentUser, maxDepth);

    return res.status(200).json({
      success: true,
      message: "Berhasil mengambil data pohon silsilah Purusa.",
      data: result
    });
  } catch (error) {
    console.error("Error in getSilsilahTree:", error);
    if (error.message === "Data Krama tidak ditemukan.") {
      return res.status(404).json({
        success: false,
        message: "Data krama tidak ditemukan."
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Terjadi kesalahan saat memproses silsilah.",
    });
  }
};
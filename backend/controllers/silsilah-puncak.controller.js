import { 
  getPuncakSilsilahService,
  getListLeluhurPuncak
} from "../services/silsilah-puncak.service.js";

export const getTrehBaliPuncak = async (req, res) => {
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
    
    const result = await getPuncakSilsilahService(rootId, maxDepth);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Struktur silsilah tidak ditemukan untuk target ini."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Berhasil memuat silsilah puncak.",
      data: result
    });
  } catch (error) {
    console.error("Error in getTrehBaliPuncak:", error); 
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan internal server.",
      server_message: error.message
    });
  }
};

export const getLeluhurPuncakOptions = async (req, res) => {
  try {
    const result = await getListLeluhurPuncak();

    return res.status(200).json({
      success: true,
      message: "Berhasil mengambil daftar leluhur puncak.",
      data: result
    });
  } catch (error) {
    console.error("Error in getLeluhurPuncakOptions:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan internal server.",
      server_message: error.message
    });
  }
};
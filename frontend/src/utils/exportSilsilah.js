import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Utility untuk mengeksport silsilah ke PNG/PDF A3 Landscape tanpa terpotong
 */
export const exportSilsilahToMedia = async (
  elementId, 
  fileName = 'Silsilah-Adat-Bali', 
  format = 'png', 
  puncakName = ''
) => {
  const element = document.getElementById(elementId);
  
  if (!element) {
    console.error(`Element dengan ID '${elementId}' tidak ditemukan.`);
    return false;
  }

  try {
    // 1. Render elemen HTML silsilah ke kanvas ultra-high resolution
    const rawCanvas = await html2canvas(element, {
      scale: 3, // High-DPI agar teks nama & badge tajam
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#FAFAFA',
      logging: false,
      onclone: (clonedDoc) => {
        // A. Hilangkan batasan potong nama Krama pada node
        const nodeTexts = clonedDoc.querySelectorAll('.nodeDisplayName, .cardName');
        nodeTexts.forEach((el) => {
          el.style.webkitLineClamp = 'none';
          el.style.overflow = 'visible';
          el.style.whiteSpace = 'normal';
          el.style.maxHeight = 'none';
        });

        // B. Perbaiki Label Istri agar utuh & tidak terpotong saat di-export
        const labelIstris = clonedDoc.querySelectorAll('.labelIstri, .labelIsUp');
        labelIstris.forEach((el) => {
          el.style.display = 'inline-block';
          el.style.whiteSpace = 'nowrap';
          el.style.overflow = 'visible';
          el.style.fontSize = '11px';
          el.style.padding = '3px 10px';
          el.style.top = '-10px';
          el.style.zIndex = '30';
        });
      }
    });

    const canvasWidth = rawCanvas.width;

    // 2. Hitung Ukuran Header & Font Dinamis Berdasarkan Lebar Kanvas
    const headerHeight = Math.max(260, Math.round(canvasWidth * 0.08));
    const titleFontSize = Math.max(32, Math.round(canvasWidth * 0.022));
    const subTitleFontSize = Math.max(22, Math.round(canvasWidth * 0.015));

    // 3. Buat Kanvas Utama (Header + Pohon Silsilah)
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = canvasWidth;
    finalCanvas.height = rawCanvas.height + headerHeight;

    const ctx = finalCanvas.getContext('2d');
    ctx.textRendering = 'geometricPrecision';

    // 3a. Background Header
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // 3b. Judul Utama (SILSILAH KELUARGA ADAT BALI)
    ctx.fillStyle = '#3A2000';
    ctx.font = `bold ${titleFontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SILSILAH KELUARGA ADAT BALI', finalCanvas.width / 2, headerHeight * 0.35);

    // 3c. Sub-Judul (Nama Krama Puncak Silsilah)
    ctx.fillStyle = '#937641';
    ctx.font = `bold italic ${subTitleFontSize}px sans-serif`;
    const subTitleText = puncakName ? `- ${puncakName} -` : '- Silsilah Puncak -';
    ctx.fillText(subTitleText, finalCanvas.width / 2, headerHeight * 0.68);

    // 3d. Garis Pembatas Header
    ctx.strokeStyle = '#C5A059';
    ctx.lineWidth = Math.max(3, Math.round(canvasWidth * 0.0015));
    ctx.beginPath();
    ctx.moveTo(canvasWidth * 0.08, headerHeight * 0.88);
    ctx.lineTo(canvasWidth * 0.92, headerHeight * 0.88);
    ctx.stroke();

    // 3e. Tempelkan Pohon Silsilah di bawah Header
    ctx.drawImage(rawCanvas, 0, headerHeight);

    // 4. Proses Export ke File
    if (format === 'png') {
      const imageURI = finalCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = imageURI;
      link.click();
      return true;
    } 
    
    if (format === 'pdf') {
      const imgData = finalCanvas.toDataURL('image/jpeg', 0.98);
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a3'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();   // 420 mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm
      
      const margin = 12; // Margin 12mm di sekeliling A3
      const maxPdfWidth = pageWidth - (margin * 2);   // 396 mm
      const maxPdfHeight = pageHeight - (margin * 2);  // 273 mm

      const imgWidth = finalCanvas.width;
      const imgHeight = finalCanvas.height;

      const widthRatio = maxPdfWidth / imgWidth;
      const heightRatio = maxPdfHeight / imgHeight;
      const bestRatio = Math.min(widthRatio, heightRatio);

      const finalWidth = imgWidth * bestRatio;
      const finalHeight = imgHeight * bestRatio;

      const xPos = (pageWidth - finalWidth) / 2;
      const yPos = (pageHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'JPEG', xPos, yPos, finalWidth, finalHeight);
      pdf.save(`${fileName}-A3.pdf`);
      return true;
    }
  } catch (error) {
    console.error("Gagal mengeksport silsilah:", error);
    return false;
  }
};
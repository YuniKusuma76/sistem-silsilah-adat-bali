// HELPER: menyiapkan objek date secara kronologis
export const siapkanTimestampKronologis = (tanggalAwal, tanggalBaruInput = null) => {
  if (!tanggalAwal) {
    throw new Error("Tanggal awal wajib disertakan!");
  }

  const dateAwal = new Date(tanggalAwal);
  let dateBaru = tanggalBaruInput ? new Date(tanggalBaruInput) : new Date();

  const tglAwalMurni = dateAwal.toISOString().split("T")[0];
  const tglBaruMurni = dateBaru.toISOString().split("T")[0];

  if (tglAwalMurni === tglBaruMurni) {
    dateAwal.setHours(0, 1, 0, 0); 
    dateBaru.setHours(8, 0, 0, 0);
  } else {
    if (tanggalBaruInput && typeof tanggalBaruInput === 'string' && !tanggalBaruInput.includes(':')) {
      dateBaru.setHours(0, 5, 0, 0);
    }
  }

  return {
    timestampAwal: dateAwal,
    timestampBaru: dateBaru
  };
};

export const dapatkanRentangWaktuHarian = (dateInput) => {
  if (!dateInput) return null;
  
  const date = new Date(dateInput);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  
  return {
    start,
    end
  };
};
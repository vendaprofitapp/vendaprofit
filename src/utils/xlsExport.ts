import * as XLSX from "xlsx";

export function downloadXlsx(data: any[][], sheetName: string, fileName: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Bold header row
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) {
      ws[addr].s = { font: { bold: true } };
    }
  }

  // Auto-size columns
  const colWidths = data[0].map((_, colIdx) => {
    let max = 10;
    data.forEach(row => {
      const val = row[colIdx];
      const len = val != null ? String(val).length : 0;
      if (len > max) max = len;
    });
    return { wch: Math.min(max + 2, 40) };
  });
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

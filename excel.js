import ExcelJS from 'exceljs';
import { schemas } from './importer.js';

export async function readExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  // Table styling is irrelevant to the import; read cell values only.
  await workbook.xlsx.load(buffer, {ignoreNodes: ['tableParts']});
  const sheets = {};
  for (const [name, required] of Object.entries(schemas)) {
    const sheet = workbook.getWorksheet(name);
    if (!sheet) continue;
    if (sheet.rowCount > 5001 || sheet.columnCount > 40) throw Error(`${name}: máximo 5000 filas y 40 columnas`);
    const headers = sheet.getRow(1).values.slice(1).map(value=>String(value ?? '').trim().toLowerCase());
    if (required.filter(h=>h!=='familia').some(h=>!headers.includes(h)) || new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) throw Error(`${name}: cabeceras requeridas en fila 1: ${required.join(', ')}`);
    const rows = [];
    for(let i=2;i<=sheet.rowCount;i++) {
      const row = sheet.getRow(i), record = {};
      for(let j=0;j<headers.length;j++) {
        if(!headers[j]) continue;
        const cell = row.getCell(j+1), value = cell.value;
        if(value && typeof value === 'object') throw Error(`${name}, fila ${i}: utiliza valores o fórmulas como texto; no fórmulas de Excel, enlaces ni objetos`);
        record[headers[j]] = value ?? '';
      }
      if(Object.values(record).some(v=>v!=='')) rows.push(record);
    }
    if (rows.length) sheets[name] = rows;
  }
  return sheets;
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {buildInitialTemplate} from './initial-template.js';
import {readExcel} from './excel.js';
import {prepareImport} from './importer.js';
import {unitPrice} from './model.js';

test('La plantilla vacía no carga ejemplos y el archivo completado importa sin tarifas', async () => {
  const buffer = await buildInitialTemplate();
  assert.deepEqual(await readExcel(buffer), {});
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  assert.ok(book.getWorksheet('Modelo de negocio'));
  assert.match(book.getWorksheet('Instrucciones').lastRow.getCell(2).value, /no inventes precios/);
  book.getWorksheet('Parametros').addRow(['horas', 'Horas (h)', 'numero', 2, '', '', '']);
  book.getWorksheet('Parametros').addRow(['acabado', 'Acabado', 'lista', 'Premium', 'Normal|Premium', 'suplemento', '0|20']);
  book.getWorksheet('Familias').addRow(['SERV', 'Servicios', 'horas|acabado']);
  book.getWorksheet('Articulos').addRow(['S1', 'Servicio', 'SERV', 'horas * 35']);
  const sheets = await readExcel(await book.xlsx.writeBuffer());
  assert.equal(sheets.Tarifas, undefined);
  assert.equal(sheets.Precios, undefined);
  const result = prepareImport({customer: '', parameters: [], families: [], articles: [], lines: [], tariffs: [], selectedTariff: ''}, sheets);
  assert.deepEqual(result.errors, []);
  assert.equal(unitPrice(result.data.articles[0], result.data), 90);
});

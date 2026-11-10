import ExcelJS from 'exceljs';
import {schemas} from './importer.js';

// Generated on download: this contract stays aligned with the application's importer.
export async function buildInitialTemplate() {
  const book = new ExcelJS.Workbook();
  book.creator = 'Imatia';
  const help = (name, headers, rows, widths) => {
    const sheet = book.addWorksheet(name);
    sheet.addRow(headers);
    rows.forEach(row => sheet.addRow(row));
    sheet.columns.forEach((column, i) => { column.width = widths[i] || 38; });
    return sheet;
  };
  help('Instrucciones', ['Paso', 'Indicaciones'], [
    ['1. Describe tu negocio', 'Completa la columna Respuesta de Modelo de negocio. Puedes adjuntar catálogos o presupuestos existentes. No incluyas datos personales innecesarios.'],
    ['2. Comparte con IA', 'Adjunta este Excel a ChatGPT y copia la petición de la última fila. La descarga no conecta automáticamente con una IA.'],
    ['3. Revisa el resultado', 'Comprueba artículos, unidades, precios, opciones y fórmulas. Pide que se resuelvan las dudas antes de importar.'],
    ['4. Importa el archivo', 'En Importar Excel, selecciona el .xlsx completado, revisa la vista previa y confirma. Se actualizan códigos existentes; no se borra el catálogo anterior.'],
    ['Hojas importables', 'Parametros, Familias, Articulos, Tarifas y Precios. Mantén sus nombres y las cabeceras en fila 1. Las demás hojas son documentación y no se importan.'],
    ['Hojas opcionales', 'Tarifas y Precios son opcionales. Deja las hojas sin datos si no las necesitas. Las filas completamente vacías se ignoran.'],
    ['Fórmulas', 'Escribe texto sin = inicial. Solo números, identificadores numéricos, + - * / y paréntesis. Usa punto decimal dentro de las fórmulas. No uses funciones ni fórmulas nativas de Excel.'],
    ['Precio y unidades', 'La fórmula devuelve el precio de UNA unidad; la cantidad se introduce después en el presupuesto. Explicita unidades en los nombres de los parámetros. Usa unidades coherentes en cada cálculo.'],
    ['Opciones con precio', 'modo_precio: suplemento (suma por unidad), coeficiente (multiplica) o valor (valor numérico usado en la fórmula). valores_precio: importes separados por |, en el mismo orden que opciones. No incluyas suplementos ni coeficientes automáticos en la fórmula.'],
    ['Límites', 'Archivo .xlsx de hasta 2 MB y 5000 filas por hoja. No añadas filas explicativas dentro de las hojas importables.'],
    ['Petición para ChatGPT', 'Adapta esta plantilla a mi modelo de negocio según mis respuestas y documentos. Pregunta por la información necesaria que falte; no inventes precios ni reglas. Completa Parametros, Familias y Articulos y, solo si lo necesito, Tarifas y Precios. Conserva nombres de hojas y cabeceras. Usa códigos únicos y referencias coherentes. Los parámetros pertenecen a familias y se configuran por línea de artículo. Incluye opciones con precio cuando proceda. Las fórmulas deben ser texto compatible con el motor, sin =, funciones ni referencias de celda. Comprueba precios con ejemplos de cálculo en una hoja no importable llamada Comprobaciones. Devuélveme un .xlsx listo para revisar e importar y enumera las dudas pendientes.']
  ], [30, 110]);
  help('Modelo de negocio', ['Tema', 'Respuesta', 'Qué indicar'], [
    ['Actividad y sector', '', 'Qué vendes y a qué tipo de cliente.'],
    ['Familias', '', 'Cómo agrupas productos o servicios que comparten parámetros.'],
    ['Artículos', '', 'Códigos, nombres y familia. Indica si se venden por unidad, metro, superficie, hora, etc.'],
    ['Medidas y parámetros', '', 'Nombre, unidad, tipo (número, texto o lista) y valor inicial.'],
    ['Opciones', '', 'Valores permitidos: materiales, acabados, calidades, servicios, etc.'],
    ['Cálculo del precio', '', 'Reglas, precios base, costes por medida, tiempos y redondeos necesarios.'],
    ['Suplementos y coeficientes', '', 'Qué opción suma un importe o multiplica el precio y cuánto.'],
    ['Tarifas opcionales', '', 'Si necesitas condiciones internas de precio o descuento por tipo de cliente. No requiere ERP.'],
    ['Casos de comprobación', '', 'Dos o tres configuraciones con sus cantidades y precios esperados.'],
    ['Restricciones', '', 'Combinaciones no válidas o mínimos. Indícalos para revisar su compatibilidad; no se importan automáticamente.'],
    ['Documentación adjunta', '', 'Catálogos, listas de precios o ejemplos que debe utilizar la IA.']
  ], [30, 65, 80]);
  const details = {
    Parametros: ['codigo: identificador sin espacios, comienza por letra o _. nombre: incluye unidad. tipo: numero, texto o lista. valor: valor inicial. opciones: separadas por |. modo_precio y valores_precio son opcionales.'],
    Familias: ['codigo y nombre únicos. parametros: códigos de Parametros separados por |. Una familia puede no tener parámetros.'],
    Articulos: ['codigo, nombre, familia (código existente) y formula de precio unitario. Precio fijo: escribe por ejemplo 50 como texto.'],
    Tarifas: ['Opcional. codigo, nombre, coeficiente (1 = sin cambio) y descuento (10 = 10 %).'],
    Precios: ['Opcional. tarifa y articulo son códigos existentes. formula sustituye a la fórmula base para esa tarifa; después se aplica su coeficiente y descuento.']
  };
  help('Diccionario', ['Hoja', 'Definición'], Object.entries(details).map(([name, texts]) => [name, texts[0]]), [25, 115]);
  help('Ejemplos no importables', ['Hoja', 'Ejemplo orientativo'], [
    ['Parametros', 'codigo=horas; nombre=Horas de trabajo (h); tipo=numero; valor=2'],
    ['Parametros', 'codigo=precio_hora; nombre=Precio hora (EUR/h); tipo=numero; valor=35'],
    ['Parametros', 'codigo=acabado; nombre=Acabado; tipo=lista; valor=Estándar; opciones=Estándar|Premium; modo_precio=suplemento; valores_precio=0|20'],
    ['Familias', 'codigo=SERVICIO; nombre=Servicios; parametros=horas|precio_hora|acabado'],
    ['Articulos', 'codigo=SERV-001; nombre=Servicio configurable; familia=SERVICIO; formula=horas * precio_hora'],
    ['Comprobación', '2 h × 35 EUR/h = 70 EUR por unidad. Con acabado Premium: 90 EUR por unidad. Son datos ficticios, no precios recomendados.']
  ], [25, 115]);
  for (const [name, fields] of Object.entries(schemas)) {
    const headers = name === 'Parametros' ? [...fields, 'modo_precio', 'valores_precio'] : fields;
    const sheet = help(name, headers, [], headers.map(h => h === 'formula' || h === 'parametros' || h === 'opciones' ? 55 : 25));
    sheet.autoFilter = {from: {row: 1, column: 1}, to: {row: 1, column: headers.length}};
    // Text formatting prevents identifiers and expression strings becoming Excel formulas.
    sheet.columns.forEach(column => { column.numFmt = '@'; });
  }
  for (const sheet of book.worksheets) {
    sheet.views = [{state: 'frozen', ySplit: 1}];
    sheet.eachRow((row, index) => {
      row.height = index === 1 ? 30 : 78;
      row.eachCell({includeEmpty: true}, cell => {
        cell.font = {name: 'Calibri', size: 12, color: {argb: index === 1 ? 'FFFFFFFF' : 'FF2C2A29'}};
        cell.alignment = {vertical: 'top', wrapText: true};
        cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: index === 1 ? 'FF2C2A29' : index % 2 ? 'FFF4F4F4' : 'FFFFFFFF'}};
      });
    });
    if (sheet.name === 'Instrucciones') sheet.lastRow.height = 175;
    if (sheet.name === 'Modelo de negocio') {
      for (let row = 2; row <= sheet.rowCount; row++) sheet.getCell(row, 2).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFFFEEE9'}};
    }
  }
  return book.xlsx.writeBuffer();
}

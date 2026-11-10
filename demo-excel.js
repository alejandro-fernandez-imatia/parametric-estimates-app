import ExcelJS from 'exceljs';
import {writeFile} from 'node:fs/promises';
import {buildInitialTemplate} from './initial-template.js';
import {demoBusinesses,demoWorkspace} from './demo-businesses.js';
import {defaultValues,unitPrice} from './model.js';

export async function buildDemoExcel(kind){
 const demo=demoBusinesses[kind],data=demoWorkspace(kind),book=new ExcelJS.Workbook();
 await book.xlsx.load(await buildInitialTemplate());
 const responses=[
  kind==='fontaneria'?'Fontanería de asistencia a viviendas: fugas accesibles, desatascos sencillos y sustituciones.':'Electricista de asistencia a viviendas: averías sencillas, cableado, mecanismos y luminarias.',
  demo.sheets.Familias.map(f=>f.nombre).join('. '),
  'Siete servicios. Unidad = una intervención, un tramo completo o un mecanismo. El desplazamiento se añade una sola vez por visita.',
  'Horas en h, longitudes en m, precios en EUR por hora o metro. Los valores iniciales son ejemplos editables por línea.',
  kind==='fontaneria'?'Horario Laborable, Urgente o Nocturno. Repuesto Estándar o Superior. Zona Local, Periferia o Fuera de zona.':'Horario Laborable, Urgente o Nocturno. Gama Básica, Diseño o Premium. Zona Local, Periferia o Fuera de zona.',
  'Mano de obra = horas × precio_hora. Reparaciones añaden material. Cable/tubería añade metros × precio_metro. Sustitución añade equipo. La cantidad multiplica toda la intervención: no vuelvas a multiplicar por metros en cantidad.',
  'El suplemento de gama se suma por unidad; el coeficiente de urgencia multiplica mano de obra y materiales/equipo de toda la línea. El desplazamiento no tiene recargo de urgencia.',
  'Sin tarifas. Se utilizan fórmulas base y opciones con precio. No hay conexión con un ERP.',
  'Consulta la hoja Comprobaciones: precios unitarios sin impuestos. Datos ficticios, no precios de mercado.',
  'Se excluyen obras ocultas, permisos, certificaciones y trabajos de alcance incierto. Revisar después de visita. No se importan restricciones automáticas. Impuestos y condiciones del presupuesto se configuran en la aplicación.',
  'Configuración ficticia elaborada para esta demo; sin documentos de precios reales.'
 ];
 const model=book.getWorksheet('Modelo de negocio');responses.forEach((value,i)=>{model.getCell(i+2,2).value=value;model.getRow(i+2).height=100;});
 const instructions=book.getWorksheet('Instrucciones');instructions.addRow(['Configuración de demo',demo.name+'. Precios ficticios en EUR sin impuestos, no utilizables como referencia de mercado. Importa en una empresa vacía para separar los negocios. El Excel importa catálogo, no datos fiscales ni presupuestos.']);instructions.lastRow.height=95;
 for(const [name,rows] of Object.entries(demo.sheets)){
  const sheet=book.getWorksheet(name),headers=sheet.getRow(1).values.slice(1);
  for(const record of rows){const row=sheet.addRow(headers.map(h=>record[h]??''));row.height=62;row.eachCell({includeEmpty:true},cell=>{cell.font={name:'Calibri',size:12,color:{argb:'FF2C2A29'}};cell.alignment={vertical:'top',wrapText:true};});}
 }
 const checks=book.addWorksheet('Comprobaciones');
 checks.columns=[{header:'Artículo',width:20},{header:'Configuración respecto al valor inicial',width:65},{header:'Precio esperado EUR sin impuestos',width:27},{header:'Precio verificado EUR sin impuestos',width:27}];
 for(const [id,overrides,expected] of demo.cases){const article=data.articles.find(a=>a.id===id),values={...defaultValues(article,data),...overrides},actual=unitPrice(article,data,{values});if(actual!==expected)throw Error(`${id}: ${actual} != ${expected}`);checks.addRow([id,Object.keys(overrides).length?Object.entries(overrides).map(([k,v])=>`${k}: ${v}`).join(', '):'Valores iniciales',expected,actual]);}
 checks.views=[{state:'frozen',ySplit:1}];checks.eachRow((row,i)=>{row.height=52;row.eachCell(cell=>{cell.alignment={wrapText:true,vertical:'top'};cell.font={name:'Calibri',size:12,color:{argb:i===1?'FFFFFFFF':'FF2C2A29'}};if(i===1)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2C2A29'}};});});
 checks.getColumn(3).numFmt='#,##0.00';checks.getColumn(4).numFmt='#,##0.00';
 return book.xlsx.writeBuffer();
}
if(process.argv.includes('--write'))for(const kind of Object.keys(demoBusinesses))await writeFile(new URL(`examples/${demoBusinesses[kind].file}`,import.meta.url),await buildDemoExcel(kind));

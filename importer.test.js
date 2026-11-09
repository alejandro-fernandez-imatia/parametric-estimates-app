import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {readExcel} from './excel.js';
import {prepareImport} from './importer.js';
import {unitPrice,validate,defaultValues} from './model.js';
import {server} from './server.js';
const empty=()=>({customer:'Prueba',parameters:[],families:[],articles:[],lines:[],tariffs:[],selectedTariff:''});
const workbook=async name=>readExcel(await readFile(new URL(`examples/${name}.xlsx`,import.meta.url)));
test('Importa el Excel completo y verifica todos los escenarios de usuario',async()=>{
 const original=empty(),result=prepareImport(original,await workbook('00_configuracion_completa'));
 assert.deepEqual(result.errors,[]);assert.equal(original.parameters.length,0);
 assert.equal(result.data.parameters.length,10);assert.equal(result.data.articles.length,12);assert.equal(result.data.tariffs.length,3);
 const cases=[['GENERAL',0.9,1,2,[93.56,24.5,70],306.12],['PRO',0.9,1,2,[78.59,19.8,57.6],254.38],['PREMIUM',0.9,1,2,[131.5,28.18,92],411.36],['GENERAL',1.2,1,2,[124.74,24.5,70],368.48],['GENERAL',0.9,1.15,2,[107.59,24.5,70],334.18],['PRO',0.9,1,3,[78.59,19.8,86.4],283.18]];
 for(const [tariff,width,finish,hours,expected,total] of cases){const data=structuredClone(result.data);data.selectedTariff=tariff;for(const [id,value] of [['ancho',width],['factor_acabado',String(finish)],['horas',hours]])data.parameters.find(p=>p.id===id).value=value;const amounts=['PUE-001','HER-001','MON-001'].map(id=>unitPrice(data.articles.find(a=>a.id===id),data));assert.deepEqual(amounts,expected);assert.equal(Math.round((amounts[0]*2+amounts[1]*2+amounts[2])*100)/100,total);}
});
test('Importación por partes, reimportación sin duplicados y conservación del presupuesto',async()=>{
 let data=empty();for(const name of ['01_parametros','02_articulos','03_tarifas']){const result=prepareImport(data,await workbook(name));assert.deepEqual(result.errors,[]);data=result.data;}
 data.lines=[{article:'PUE-001',quantity:2,values:defaultValues(data.articles.find(a=>a.id==='PUE-001'),data)}];data.lines[0].values.ancho=1.5;const result=prepareImport(data,await workbook('00_configuracion_completa'));assert.deepEqual(result.errors,[]);assert.deepEqual(result.data.lines,data.lines);assert.ok(result.summary.every(s=>s.added===0));assert.equal(result.summary.find(s=>s.name==='Precios').updated,12);
});
test('Errores de filas, referencias, fórmulas y límites sin mutar datos',async()=>{
 const data=prepareImport(empty(),await workbook('00_configuracion_completa')).data;const before=JSON.stringify(data);
 for(const sheets of [
 {Parametros:[{codigo:'x',nombre:'X',tipo:'numero',valor:'',opciones:''}]},
 {Parametros:[{codigo:'x',nombre:'X',tipo:'lista',valor:'A',opciones:'B|C'}]},
 {Articulos:[{codigo:'X',nombre:'X',formula:'desconocido * 2'}]},
 {Precios:[{tarifa:'NO',articulo:'PUE-001',formula:'3'}]},
 {Precios:[{tarifa:'PRO',articulo:'NO',formula:'3'}]},
 {Tarifas:[{codigo:'X',nombre:'X',coeficiente:1,descuento:101}]},
 {Articulos:[{codigo:'X',nombre:'X',formula:'2'},{codigo:'X',nombre:'Y',formula:'3'}]},
 {Articulos:[{codigo:'X',nombre:'X'}]},
 {Otra:[]}
 ]){assert.ok(prepareImport(data,sheets).errors.length>0);assert.equal(JSON.stringify(data),before);}
});
test('Rechaza fórmulas nativas de Excel y cabeceras incorrectas',async()=>{
 for(const wrong of ['formula','header']){const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Articulos');sheet.addRow(wrong==='header'?['codigo','nombre']:['codigo','nombre','formula']);sheet.addRow(['X','Ejemplo',{formula:'1+2',result:3}]);await assert.rejects(readExcel(await book.xlsx.writeBuffer()));}
});
test('Migra JSON previo, mantiene tarifas en JSON y aplica fallback a precio base',async()=>{
 const legacy=validate({customer:'',parameters:[],articles:[{id:'x',name:'X',formula:'100'}],lines:[]});assert.deepEqual(legacy.tariffs,[]);legacy.tariffs=[{id:'T',name:'Tarifa',multiplier:1.2,discount:10,prices:[]}];legacy.selectedTariff='T';assert.equal(unitPrice(legacy.articles[0],validate(JSON.parse(JSON.stringify(legacy)))),108);
});
test('Servidor entrega app, descargas y endpoint Excel',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const url=`http://127.0.0.1:${server.address().port}`;for(const path of ['/','/app.js','/workflows.js','/importer.js','/examples/00_configuracion_completa.xlsx'])assert.equal((await fetch(url+path)).status,200);
 const response=await fetch(url+'/api/excel',{method:'POST',body:await readFile(new URL('examples/00_configuracion_completa.xlsx',import.meta.url))});assert.equal(response.status,200);assert.deepEqual(prepareImport(empty(),await response.json()).errors,[]);
 assert.equal((await fetch(url+'/api/excel',{method:'POST',body:'invalid'})).status,400);
 assert.equal((await fetch(url+'/api/excel',{method:'POST',headers:{Origin:'https://other.example'},body:'invalid'})).status,403);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

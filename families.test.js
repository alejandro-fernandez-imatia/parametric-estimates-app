import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readExcel} from './excel.js';
import {prepareImport} from './importer.js';
import {validate,validateCatalog,unitPrice,defaultValues,familyParameters,reconcileLines} from './model.js';
async function sample(){const result=prepareImport({customer:'',parameters:[],families:[],articles:[],lines:[]},await readExcel(await readFile(new URL('examples/00_configuracion_completa.xlsx',import.meta.url))));assert.deepEqual(result.errors,[]);return result.data;}
const addLine=(data,id,values={})=>{const article=data.articles.find(a=>a.id===id),line={article:id,quantity:1,values:{...defaultValues(article,data),...values}};data.lines.push(line);return line;};
test('Mismo artículo, medidas y horas independientes por línea',async()=>{
 const data=await sample();assert.equal(data.families.length,7);data.selectedTariff='GENERAL';
 const lines=[addLine(data,'PUE-001'),addLine(data,'PUE-001',{ancho:1.2}),addLine(data,'MON-001'),addLine(data,'MON-001',{horas:3})];
 const amounts=lines.map(line=>unitPrice(data.articles.find(a=>a.id===line.article),data,line));assert.deepEqual(amounts,[93.56,124.74,70,105]);assert.equal(Math.round(amounts.reduce((a,b)=>a+b,0)*100)/100,393.3);
 lines[0].values.ancho=1.5;assert.equal(lines[1].values.ancho,1.2);assert.equal(lines[2].values.horas,2);assert.equal(lines[3].values.horas,3);assert.deepEqual(validate(JSON.parse(JSON.stringify(data))),data);
 data.selectedTariff='PRO';assert.notEqual(unitPrice(data.articles[0],data,lines[0]),unitPrice(data.articles[0],data,lines[1]));assert.equal(lines[1].values.ancho,1.2);
});
test('Los parámetros visibles y las fórmulas quedan limitados a la familia',async()=>{
 const data=await sample(),door=data.articles.find(a=>a.id==='PUE-001'),hardware=data.articles.find(a=>a.id==='HER-001');
 assert.equal(familyParameters(hardware,data).length,0);assert.ok(!familyParameters(door,data).some(p=>p.id==='horas'));
 door.formula='horas * 10';assert.throws(()=>validateCatalog(data));
 const rejected=prepareImport(await sample(),{Precios:[{tarifa:'PRO',articulo:'PUE-001',formula:'horas * 10'}]});assert.ok(rejected.errors.length);
});
test('Migración preserva el precio y copia los valores anteriores sin compartirlos',()=>{
 const old={customer:'Cliente',parameters:[{id:'ancho',name:'Ancho',type:'number',value:2,options:[]}],articles:[{id:'A',name:'A',formula:'ancho * 10'}],lines:[{article:'A',quantity:1},{article:'A',quantity:2}]};
 const data=validate(old);assert.equal(data.articles[0].family,'GENERAL');assert.equal(unitPrice(data.articles[0],data,data.lines[0]),20);data.lines[0].values.ancho=3;assert.equal(data.lines[1].values.ancho,2);
});
test('Cambiar valores iniciales no altera líneas existentes; cambiar familia reconcilia campos',async()=>{
 const data=await sample(),line=addLine(data,'PUE-001',{ancho:1.4});data.parameters.find(p=>p.id==='ancho').value=2;
 reconcileLines(data);assert.equal(line.values.ancho,1.4);assert.equal(addLine(data,'PUE-001').values.ancho,2);
 const family=data.families.find(f=>f.id==='PUERTAS');family.parameters.push('horas');reconcileLines(data);assert.equal(line.values.horas,2);family.parameters=family.parameters.filter(id=>id!=='horas');reconcileLines(data);assert.ok(!Object.hasOwn(line.values,'horas'));assert.equal(line.values.ancho,1.4);
});
test('Rechaza familias desconocidas, duplicadas y referencias inválidas sin modificar el original',async()=>{
 const data=await sample(),before=JSON.stringify(data);
 for(const sheets of [{Familias:[{codigo:'X',nombre:'X',parametros:'no_existe'}]},{Articulos:[{codigo:'X',nombre:'X',familia:'NO',formula:'10'}]},{Familias:[{codigo:'X',nombre:'X',parametros:'ancho|ancho'}]}]){assert.ok(prepareImport(data,sheets).errors.length);assert.equal(JSON.stringify(data),before);}
});
test('Los Excel anteriores sin familia siguen siendo importables en General',()=>{
 const result=prepareImport({customer:'',parameters:[],articles:[],lines:[]},{Parametros:[{codigo:'x',nombre:'X',tipo:'numero',valor:2,opciones:''}],Articulos:[{codigo:'A',nombre:'A',formula:'x * 10'}]});assert.deepEqual(result.errors,[]);assert.equal(result.data.articles[0].family,'GENERAL');assert.equal(unitPrice(result.data.articles[0],result.data),20);
});

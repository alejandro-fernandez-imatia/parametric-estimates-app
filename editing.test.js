import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateWorkspace,freezeLine,rememberEstimate,lineAmounts} from './estimates.js';
import {unitPrice,formulaValues,validateCatalog} from './model.js';
import {applyBulkParameter,commonParameters,createHistory} from './editing.js';
import {prepareImport} from './importer.js';
function sample(){
 const parameters=[{id:'ancho',name:'Ancho',type:'number',value:2,options:[]},{id:'material',name:'Material',type:'select',value:'Haya',options:['Haya','Roble'],optionPricing:{mode:'add',values:[{option:'Haya',amount:10},{option:'Roble',amount:20}]}},{id:'acabado',name:'Acabado',type:'select',value:'Natural',options:['Natural','Lacado'],optionPricing:{mode:'multiply',values:[{option:'Natural',amount:1},{option:'Lacado',amount:1.2}]}}];
 const data=validateWorkspace({customer:'Cliente',parameters,families:[{id:'F',name:'Familia',parameters:parameters.map(p=>p.id)}],articles:[{id:'A',name:'Artículo',family:'F',formula:'ancho * 50'}],lines:[{article:'A',quantity:2,values:{ancho:2,material:'Haya',acabado:'Natural'},discount:10},{article:'A',quantity:1,values:{ancho:3,material:'Roble',acabado:'Lacado'}}]});
 data.lines=data.lines.map(l=>freezeLine(data,l));return data;
}
test('Suplementos y coeficientes se aplican automáticamente antes de los descuentos',()=>{
 const data=sample();assert.equal(unitPrice(data.articles[0],data,data.lines[0]),110);assert.equal(unitPrice(data.articles[0],data,data.lines[1]),204);assert.equal(lineAmounts(data,data.lines[0]).net,198);
 assert.deepEqual(formulaValues(data.articles[0],data),{ancho:2});
});
test('Opciones con valor para fórmula y listas antiguas compatibles',()=>{
 const data=sample();data.parameters.find(p=>p.id==='material').optionPricing.mode='value';data.articles[0].formula='ancho * material';data.lines=[];assert.doesNotThrow(()=>validateCatalog(data));assert.equal(unitPrice(data.articles[0],data),20);
 delete data.parameters.find(p=>p.id==='material').optionPricing;data.articles[0].formula='ancho * 50';assert.equal(unitPrice(data.articles[0],data),100);
});
test('Rechaza valores de opciones incompletos, negativos y suplementos usados dos veces en fórmula',()=>{
 for(const edit of [p=>p.optionPricing.values.pop(),p=>p.optionPricing.values[0].amount=-1,p=>p.optionPricing.values[0].option='Otro',p=>p.optionPricing.mode='desconocido']){const data=sample();edit(data.parameters[1]);assert.throws(()=>validateWorkspace(data));}
 const data=sample();data.articles[0].formula='ancho * material';assert.throws(()=>validateCatalog(data));
});
test('Cambio múltiple modifica solo las líneas seleccionadas y es atómico',()=>{
 const data=sample(),before=JSON.stringify(data),result=applyBulkParameter(data,[0,1],'material','Roble');assert.equal(result.lines[0].values.material,'Roble');assert.equal(result.lines[1].values.material,'Roble');assert.equal(result.lines[0].values.ancho,2);assert.equal(result.lines[0].discount,10);assert.equal(JSON.stringify(data),before);
 const one=applyBulkParameter(data,[0],'ancho','4');assert.equal(one.lines[0].values.ancho,4);assert.equal(one.lines[1].values.ancho,3);
 for(const args of [[[],'ancho',1],[[99],'ancho',1],[[0,1],'material','No existe'],[[0,1],'ancho',''],[[0,1],'ancho',-2]])assert.throws(()=>applyBulkParameter(data,...args));assert.equal(JSON.stringify(data),before);
});
test('Excluye parámetros incompatibles entre distintas versiones de presupuesto',()=>{
 const data=sample();data.lines[1].snapshot.parameters[1].optionPricing.values[0].amount=99;
 assert.ok(!commonParameters(data,[0,1]).some(p=>p.id==='material'));assert.ok(commonParameters(data,[0,1]).some(p=>p.id==='ancho'));assert.throws(()=>applyBulkParameter(data,[0,1],'material','Roble'));
});
test('Precios congelados y copia JSON conservan las opciones económicas anteriores',()=>{
 const data=sample();rememberEstimate(data);data.parameters[1].optionPricing.values[0].amount=1000;
 assert.equal(unitPrice(data.articles[0],data,data.lines[0]),110);const restored=validateWorkspace(JSON.parse(JSON.stringify(data)));assert.equal(unitPrice(restored.articles[0],restored,restored.lines[0]),110);
});
test('Historial limitado copia estados y permite restaurar sin modificar el original',()=>{
 const history=createHistory(2),original={lines:[{value:1}]};history.push(original);original.lines[0].value=2;assert.equal(history.peek().lines[0].value,1);history.push({n:2});history.push({n:3});assert.equal(history.size,2);assert.deepEqual(history.pop(),{n:3});assert.deepEqual(history.pop(),{n:2});assert.equal(history.peek(),null);
});
test('Importa valores de opciones desde columnas opcionales y preserva configuración si se omiten',()=>{
 const data=sample();const sheets={Parametros:[{codigo:'material',nombre:'Material',tipo:'lista',valor:'Roble',opciones:'Haya|Roble',modo_precio:'suplemento',valores_precio:'12,5|24'}]};
 const result=prepareImport(data,sheets);assert.deepEqual(result.errors,[]);assert.equal(result.data.parameters[1].optionPricing.values[0].amount,12.5);
 delete sheets.Parametros[0].modo_precio;delete sheets.Parametros[0].valores_precio;const preserved=prepareImport(result.data,sheets);assert.deepEqual(preserved.errors,[]);assert.equal(preserved.data.parameters[1].optionPricing.values[0].amount,12.5);
});

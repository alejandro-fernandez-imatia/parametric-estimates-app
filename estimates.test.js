import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateWorkspace,rememberEstimate,newEstimate,openEstimate,duplicateEstimate,duplicateLine,freezeLine,lineAmounts,estimateTotals,searchArticles} from './estimates.js';
import {unitPrice} from './model.js';
import {buildEstimatePdf} from './pdf.js';
import {server} from './server.js';
function sample(){return validateWorkspace({customer:'Carpintería de prueba',parameters:[{id:'ancho',name:'Ancho (m)',type:'number',value:2,options:[]}],families:[{id:'P',name:'Paneles',parameters:['ancho']}],articles:[{id:'PAN-01',family:'P',name:'Panel melamínico',formula:'ancho * 50'}],lines:[{article:'PAN-01',quantity:2,values:{ancho:2},discount:10}]});}
test('Descuento por línea, portes, base e impuesto con redondeo monetario',()=>{
 const data=sample();data.commercial.shipping=15;data.commercial.tax=21;
 assert.deepEqual(lineAmounts(data,data.lines[0]),{unit:100,gross:200,deduction:20,net:180});
 assert.deepEqual(estimateTotals(data),{gross:200,discount:20,net:180,shipping:15,base:195,tax:21,taxAmount:40.95,total:235.95});
 data.lines[0].discount=100;assert.equal(estimateTotals(data).total,18.15);
 data.lines[0].discount=-1;assert.throws(()=>validateWorkspace(data));
});
test('Guarda y abre varios presupuestos sin restaurar el catálogo anterior',()=>{
 const data=sample();rememberEstimate(data);const id=data.estimate.id,number=data.estimate.number;
 const next=newEstimate(data);assert.notEqual(next.estimate.id,id);assert.notEqual(next.estimate.number,number);assert.equal(next.customer,'');assert.equal(next.lines.length,0);
 next.articles[0].name='Descripción actualizada';next.articles[0].formula='ancho * 100';
 const opened=openEstimate(next,id);assert.equal(opened.articles[0].formula,'ancho * 100');assert.equal(opened.lines[0].snapshot.article.name,'Panel melamínico');assert.equal(unitPrice(opened.articles[0],opened,opened.lines[0]),100);assert.equal(opened.customer,data.customer);assert.equal(opened.savedEstimates.length,2);
 assert.doesNotThrow(()=>validateWorkspace(JSON.parse(JSON.stringify(opened))));
});
test('Duplicar presupuesto y líneas crea valores independientes',()=>{
 const data=sample();rememberEstimate(data);const copy=duplicateEstimate(data);assert.notEqual(copy.estimate.id,data.estimate.id);assert.equal(copy.estimate.status,'Borrador');copy.lines[0].values.ancho=3;assert.equal(data.lines[0].values.ancho,2);
 duplicateLine(copy,0);copy.lines[1].values.ancho=4;copy.lines[1].discount=25;assert.equal(copy.lines[0].values.ancho,3);assert.equal(copy.lines[0].discount,10);assert.equal(copy.lines[1].snapshot.article.formula,'ancho * 50');
});
test('Precios específicos congelados y configuración de artículos eliminados del catálogo',()=>{
 const data=sample();data.tariffs=[{id:'PRO',name:'Pro',multiplier:1,discount:5,prices:[{article:'PAN-01',formula:'ancho * 40'}]}];data.selectedTariff='PRO';rememberEstimate(data);
 data.tariffs=[];data.articles=[];data.families=[];data.parameters=[];
 assert.doesNotThrow(()=>validateWorkspace(data));assert.equal(unitPrice(null,data,data.lines[0]),76);
});
test('Número único, fechas, condiciones y JSON rechazados cuando no son válidos',()=>{
 const data=sample();rememberEstimate(data);const next=newEstimate(data);next.estimate.number=data.estimate.number;assert.throws(()=>validateWorkspace(next));
 for(const mutate of [d=>d.estimate.date='2026-02-30',d=>d.estimate.status='Otro',d=>d.commercial.tax=101,d=>d.commercial.shipping=-1,d=>d.commercial.validUntil='2000-01-01',d=>d.savedEstimates='invalid']){const copy=sample();mutate(copy);assert.throws(()=>validateWorkspace(copy));}
});
test('Búsqueda por código, palabras, descripción sin acentos y familia',()=>{
 const data=sample();assert.equal(searchArticles(data,'melaminico panel','P').length,1);assert.equal(searchArticles(data,'pan-01').length,1);assert.equal(searchArticles(data,'paneles').length,1);assert.equal(searchArticles(data,'panel','NO').length,0);assert.equal(searchArticles(data,'no existe').length,0);
});
test('PDF exige datos mínimos y genera documento multipágina',async()=>{
 const data=sample();await assert.rejects(buildEstimatePdf(data));data.issuer.name='Taller de ejemplo';data.issuer.address='Calle de Prueba 12';data.commercial.terms='Entrega estimada: 15 días. Pago: transferencia.';data.lines=Array.from({length:40},()=>freezeLine(data,structuredClone(data.lines[0])));
 const pdf=await buildEstimatePdf(data);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>5000);assert.ok((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length>1);
});
test('Endpoint PDF entrega contenido y rechaza datos inválidos y otro origen',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
 try{const data=sample();data.issuer.name='Empresa de prueba';const response=await fetch(url+'/api/pdf',{method:'POST',body:JSON.stringify(data)});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0,5).toString(),'%PDF-');assert.equal((await fetch(url+'/api/pdf',{method:'POST',body:'{}'})).status,400);assert.equal((await fetch(url+'/api/pdf',{method:'POST',headers:{Origin:'https://other.example'},body:JSON.stringify(data)})).status,403);
 }finally{await new Promise(r=>server.close(r));}
});

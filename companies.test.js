import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadCompanies,persistCompanies,addCompany,removeCompany,emptyCompany,companyKey} from './companies.js';
import {demoBusinesses,demoWorkspace} from './demo-businesses.js';
import {readExcel} from './excel.js';
import {prepareImport} from './importer.js';
import {unitPrice,defaultValues} from './model.js';
import {estimateTotals} from './estimates.js';
test('Migración y empresas independientes al guardar, cambiar y recargar',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 const original=emptyCompany('Original');original.customer='Cliente original';
 let state=loadCompanies(storage,original);state=persistCompanies(storage,state,original);
 state=addCompany(state,'Fontanero',demoWorkspace('fontaneria'));state=persistCompanies(storage,state,state.companies.at(-1).workspace);
 const plumbingId=state.active;
 state=addCompany(state,'Electricista',demoWorkspace('electricidad'));state=persistCompanies(storage,state,state.companies.at(-1).workspace);
 const modified=structuredClone(state.companies.at(-1).workspace);modified.customer='Solo electricista';state=persistCompanies(storage,state,modified);
 const reloaded=loadCompanies(storage,original);
 assert.equal(reloaded.companies.length,3);assert.equal(reloaded.companies[0].workspace.customer,'Cliente original');
 assert.equal(reloaded.companies.find(c=>c.id===plumbingId).workspace.customer,'Vivienda de ejemplo');
 assert.equal(reloaded.companies.at(-1).workspace.customer,'Solo electricista');
 assert.throws(()=>persistCompanies({setItem(){throw Error('quota');}},state,modified),/quota/);
 assert.equal(state.companies[0].workspace.articles.length,0);
 map.set(companyKey,'invalid');assert.throws(()=>loadCompanies(storage,original));
});
test('Los Excel de cada oficio importan y calculan todas las comprobaciones',async()=>{
 for(const [kind,demo] of Object.entries(demoBusinesses)){
  const sheets=await readExcel(await readFile(new URL(`examples/${demo.file}`,import.meta.url)));
  const result=prepareImport(emptyCompany(demo.name),sheets);assert.deepEqual(result.errors,[]);assert.equal(result.data.articles.length,7);assert.equal(result.data.tariffs.length,0);
  for(const [id,overrides,expected] of demo.cases){const a=result.data.articles.find(a=>a.id===id);assert.equal(unitPrice(a,result.data,{values:{...defaultValues(a,result.data),...overrides}}),expected);}
  assert.equal(estimateTotals(demoWorkspace(kind)).total,kind==='fontaneria'?83:82);
 }
});
test('Eliminar empresas conserva las demás y sustituye la última por una vacía',()=>{
 const first={active:'A',companies:[{id:'A',name:'A',workspace:demoWorkspace('fontaneria')},{id:'B',name:'B',workspace:demoWorkspace('electricidad')}]};
 const inactive=removeCompany(first,'B');assert.equal(inactive.active,'A');assert.deepEqual(inactive.companies[0],first.companies[0]);
 const active=removeCompany(first,'A');assert.equal(active.active,'B');assert.deepEqual(active.companies[0],first.companies[1]);assert.equal(first.companies.length,2);
 const last=removeCompany(active,'B');assert.equal(last.companies.length,1);assert.notEqual(last.active,'B');assert.equal(last.companies[0].workspace.savedEstimates.length,0);
 assert.throws(()=>removeCompany(first,'missing'),/no encontrada/);
});

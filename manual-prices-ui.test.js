import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {demoWorkspace} from './demo-businesses.js';
test('Interfaz: elegir tarifa, editar precio, deshacer y restaurar cálculo',async()=>{
 const dom=new JSDOM(await readFile(new URL('index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});
 globalThis.document=dom.window.document;globalThis.localStorage=dom.window.localStorage;globalThis.FormData=dom.window.FormData;
 const data=demoWorkspace('fontaneria');data.tariffs.push({id:'T',name:'Especial',multiplier:2,discount:0,prices:[]});localStorage.setItem('elastic-parametric-v1',JSON.stringify(data));
 const $=s=>document.querySelector(s),change=(s,v)=>{const el=$(s);el.value=v;el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));},state=()=>JSON.parse(localStorage.getItem('elastic-parametric-v1'));
 await import('./app.js');change('#selected-tariff','T');assert.equal($('[data-manual-price="0"]').value,'126');
 change('[data-manual-price="0"]','95');assert.equal(state().lines[0].manualPrice,95);assert.ok($('[data-reset-price="0"]'));
 change('#selected-tariff','');assert.equal($('[data-manual-price="0"]').value,'95');
 $('[data-reset-price="0"]').click();assert.equal(state().lines[0].manualPrice,undefined);assert.equal($('[data-manual-price="0"]').value,'63');
 $('#undo').click();assert.equal(state().lines[0].manualPrice,95);assert.equal($('[data-manual-price="0"]').value,'95');
 change('[data-manual-price="0"]','-1');assert.equal(state().lines[0].manualPrice,95);assert.match($('#notice').textContent,/mayor o igual/);
 dom.window.close();
});

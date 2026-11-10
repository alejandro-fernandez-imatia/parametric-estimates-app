import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {validateWorkspace} from './estimates.js';

test('Interfaz: selección, cambio múltiple, deshacer, eliminación y precios de listas',async()=>{
 const dom=new JSDOM(await readFile(new URL('index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});
 globalThis.document=dom.window.document;globalThis.localStorage=dom.window.localStorage;globalThis.FormData=dom.window.FormData;globalThis.confirm=()=>true;
 const fixture=validateWorkspace({customer:'Prueba',parameters:[{id:'ancho',name:'Ancho',type:'number',value:1,options:[]}],families:[{id:'F',name:'Familia',parameters:['ancho']}],articles:[{id:'A',name:'Artículo',family:'F',formula:'ancho * 100'}],lines:[{article:'A',quantity:1,values:{ancho:1}},{article:'A',quantity:1,values:{ancho:2}}]});
 localStorage.setItem('elastic-parametric-v1',JSON.stringify(fixture));
 const $=selector=>document.querySelector(selector),state=()=>JSON.parse(localStorage.getItem('elastic-parametric-v1'));
 const change=(selector,value)=>{const el=$(selector);assert.ok(el,selector);el.value=value;el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
 const submit=selector=>$(selector).dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
 await import('./app.js');assert.equal($('#undo').disabled,true);
 $('[data-select-line="0"]').click();$('[data-select-line="1"]').click();assert.ok($('#bulk-form'));change('#bulk-form [name="value"]','3');submit('#bulk-form');assert.deepEqual(state().lines.map(l=>l.values.ancho),[3,3]);assert.equal($('#undo').disabled,false);
 $('#undo').click();assert.deepEqual(state().lines.map(l=>l.values.ancho),[1,2]);assert.equal($('#undo').disabled,true);
 $('[data-delete-line="0"]').click();assert.equal(state().lines.length,1);$('#undo').click();assert.equal(state().lines.length,2);assert.deepEqual(state().lines.map(l=>l.values.ancho),[1,2]);
 $('[data-view="parameters"]').click();change('#parameter-form [name="id"]','material');change('#parameter-form [name="name"]','Material');change('#parameter-form [name="type"]','select');change('#parameter-form [name="options"]','Haya, Roble');change('#parameter-form [name="value"]','Haya');$('#parameter-form [name="pricingEnabled"]').click();change('[data-price-option="Haya"]','10');change('[data-price-option="Roble"]','25');submit('#parameter-form');assert.equal(state().parameters.find(p=>p.id==='material').optionPricing.values[1].amount,25);
 $('[data-edit-param="material"]').click();assert.equal($('#parameter-form [name="pricingEnabled"]').checked,true);assert.equal($('[data-price-option="Roble"]').value,'25');
 $('[data-view="families"]').click();$('[data-edit-family="F"]').click();$('#family-form [name="parameters"][value="material"]').checked=true;submit('#family-form');
 $('[data-view="quote"]').click();submit('#line-form');assert.equal(state().lines.length,3);assert.equal(state().lines[2].values.material,'Haya');assert.match($('[data-line="2"][data-param="material"]').textContent,/25,00/);change('[data-line="2"][data-param="material"]','Roble');assert.match($('.quote-summary .total').textContent,/425,00/);
 $('[data-view="articles"]').click();change('#article-form [name="formula"]','ancho * 100');$('#article-form [name="formula"]').dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.match($('#formula-result').textContent,/110,00/);change('[data-formula-test="material"]','Roble');assert.match($('#formula-result').textContent,/125,00/);assert.equal($('[data-insert-formula="material"]'),null);
 $('[data-view="quote"]').click();const count=state().lines.length;$('[data-delete-line="2"]').click();$('[data-save-estimate]').click();
 const originalSetItem=dom.window.Storage.prototype.setItem;dom.window.Storage.prototype.setItem=()=>{throw Error('Quota');};$('#undo').click();assert.match($('#notice').textContent,/No se pudo guardar/);assert.equal(state().lines.length,count-1);dom.window.Storage.prototype.setItem=originalSetItem;$('#undo').click();assert.equal(state().lines.length,count);
 // Field-level Ctrl+Z remains native.
 const event=new dom.window.KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true});$('#customer').dispatchEvent(event);assert.equal(event.defaultPrevented,false);assert.equal(state().lines.length,count);
 dom.window.close();
});

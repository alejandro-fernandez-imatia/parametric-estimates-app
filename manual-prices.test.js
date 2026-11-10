import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoWorkspace} from './demo-businesses.js';
import {selectEstimateTariff,lineAmounts,rememberEstimate,openEstimate,newEstimate,duplicateEstimate,validateWorkspace} from './estimates.js';
test('Tarifa de presupuesto actualiza líneas congeladas y respeta precios manuales',()=>{
 const data=demoWorkspace('fontaneria');
 data.tariffs.push({id:'T',name:'Especial',multiplier:1.1,discount:10,prices:[{article:'FON-001',formula:'100'}]});
 const next=selectEstimateTariff(data,'T');assert.equal(data.selectedTariff,'');assert.equal(next.selectedTariff,'T');
 assert.equal(lineAmounts(next,next.lines[0]).unit,99);assert.equal(lineAmounts(next,next.lines[1]).unit,19.8);
 next.lines[0].manualPrice=80;next.lines[0].quantity=2;next.lines[0].discount=10;
 const base=selectEstimateTariff(next,'');assert.equal(lineAmounts(base,base.lines[0]).net,144);
 base.lines[0].values.horas=3;assert.equal(lineAmounts(base,base.lines[0]).unit,80);
 delete base.lines[0].manualPrice;assert.equal(lineAmounts(base,base.lines[0]).unit,139);
 next.lines[0].manualPrice=0;assert.equal(lineAmounts(next,next.lines[0]).net,0);
 next.lines[0].manualPrice=80;rememberEstimate(next);const id=next.estimate.id;
 const reopened=openEstimate(newEstimate(next),id);assert.equal(reopened.lines[0].manualPrice,80);assert.equal(reopened.selectedTariff,'T');
 assert.equal(duplicateEstimate(next).lines[0].manualPrice,80);
 for(const price of [-1,NaN,Infinity,'80',null]){const invalid=structuredClone(next);invalid.lines[0].manualPrice=price;assert.throws(()=>validateWorkspace(invalid),/Precio manual/);}
 const incompatible=structuredClone(data);incompatible.tariffs[0].prices[0].formula='unknown';assert.throws(()=>selectEstimateTariff(incompatible,'T'));assert.equal(data.selectedTariff,'');
});

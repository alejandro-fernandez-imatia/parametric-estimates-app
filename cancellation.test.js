import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setEstimateStatus,newEstimate,rememberEstimate,duplicateEstimate,openEstimate} from './estimates.js';
import {demoWorkspace} from './demo-businesses.js';
test('Anular conserva datos e importes, permite recuperar y duplicar como borrador',()=>{
 const original=demoWorkspace('fontaneria'),id=original.estimate.id;
 const cancelled=setEstimateStatus(original,id,'Anulado');
 assert.equal(original.estimate.status,'Borrador');assert.equal(cancelled.estimate.status,'Anulado');
 assert.deepEqual(cancelled.lines,original.lines);assert.equal(cancelled.estimate.number,original.estimate.number);
 assert.equal(openEstimate(cancelled,id).estimate.status,'Anulado');
 assert.equal(duplicateEstimate(cancelled,id).estimate.status,'Borrador');
 assert.equal(setEstimateStatus(cancelled,id,'Borrador').estimate.status,'Borrador');
 const other=newEstimate(original);rememberEstimate(other);const active=other.estimate.id;
 const archived=setEstimateStatus(other,id,'Anulado');assert.equal(archived.estimate.id,active);assert.equal(archived.estimate.status,'Borrador');
 assert.equal(archived.savedEstimates.find(q=>q.estimate.id===id).estimate.status,'Anulado');
 assert.throws(()=>setEstimateStatus(other,'missing','Anulado'),/no encontrado/);
});

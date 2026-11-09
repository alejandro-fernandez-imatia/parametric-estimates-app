import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, validate } from './model.js';
test('Calcula variables, precedencia, paréntesis y signos',()=>{assert.equal(calculate('ancho * (alto + 1) * 45',{ancho:2,alto:3}),360);assert.equal(calculate('-2 + 3 * 4',{}),10);assert.equal(calculate('10 / 2',{}),5);});
test('Rechaza expresiones incompletas y ejecución de código',()=>{for(const formula of ['1 / 0','x + 1','2 +','(2+3','2 3','Math.random()','1;alert(1)',''])assert.throws(()=>calculate(formula,{}));});
test('Valida importaciones y referencias de líneas',()=>{const data={customer:'',parameters:[],articles:[{id:'a',name:'A',formula:'2'}],lines:[{article:'a',quantity:1}]};assert.equal(validate(data),data);assert.throws(()=>validate({...data,lines:[{article:'b',quantity:1}]}));assert.throws(()=>validate({...data,articles:[...data.articles,...data.articles]}));assert.throws(()=>validate({...data,lines:[{article:'a',quantity:-1}]}));});

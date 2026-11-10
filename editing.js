import {lineParameters,lineAmounts,validateWorkspace} from './estimates.js';

export function createHistory(limit=20){
 const entries=[];
 return {push:state=>{entries.push(structuredClone(state));if(entries.length>limit)entries.shift();},peek:()=>entries.length?structuredClone(entries[entries.length-1]):null,pop:()=>entries.pop(),clear:()=>{entries.length=0;},get size(){return entries.length;}};
}
function selection(data,indexes){
 const unique=[...new Set(indexes)];
 if(!unique.length||unique.some(i=>!Number.isInteger(i)||i<0||!data.lines[i]))throw Error('Selecciona al menos una línea válida');
 return unique;
}
const signature=p=>JSON.stringify({name:p.name,type:p.type,options:p.type==='select'?[...p.options].sort():[],pricing:p.optionPricing?{mode:p.optionPricing.mode,values:[...p.optionPricing.values].sort((a,b)=>a.option.localeCompare(b.option))}:null});
export function commonParameters(data,indexes){
 const selected=selection(data,indexes),first=lineParameters(data,data.lines[selected[0]]);
 return first.filter(p=>selected.every(i=>lineParameters(data,data.lines[i]).some(other=>other.id===p.id&&signature(other)===signature(p))));
}
export function applyBulkParameter(data,indexes,id,value){
 const selected=selection(data,indexes),parameter=commonParameters(data,selected).find(p=>p.id===id);
 if(!parameter)throw Error('El parámetro no es compatible en todas las líneas seleccionadas');
 if(parameter.type==='number'&&(value===''||typeof value==='boolean'||!Number.isFinite(Number(value))))throw Error('Introduce un número válido');
 if(parameter.type==='select'&&!parameter.options.includes(value))throw Error('Opción no válida');
 if(!['number','string'].includes(typeof value))throw Error('Valor no válido');
 const next=structuredClone(data);
 for(const index of selected)next.lines[index].values[id]=parameter.type==='number'?Number(value):String(value);
 validateWorkspace(next);
 for(const index of selected)lineAmounts(next,next.lines[index]);
 return next;
}

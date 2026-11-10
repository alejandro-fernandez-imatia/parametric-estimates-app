import {validate,unitPrice,familyParameters} from './model.js';
export const statuses=['Borrador','Enviado','Aceptado','Rechazado','Anulado'];
export const round=value=>Math.round((value+Number.EPSILON*Math.max(1,Math.abs(value)))*100)/100;
export function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
const dateValid=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
export const lineArticle=(data,line)=>line.snapshot?.article||data.articles.find(a=>a.id===line.article);
export const lineParameters=(data,line)=>line.snapshot?.parameters||familyParameters(lineArticle(data,line),data);
export function freezeLine(data,line){
 if(line.snapshot)return line;
 const article=lineArticle(data,line);
 return {...structuredClone(line),discount:line.discount??0,snapshot:{article:structuredClone(article),parameters:structuredClone(familyParameters(article,data)),familyName:data.families.find(f=>f.id===article.family)?.name||'',tariffs:data.tariffs.map(t=>({...structuredClone(t),prices:t.prices.filter(p=>p.article===article.id)}))}};
}
function numberFor(data,date=today()){
 const prefix=`P-${date.slice(0,4)}-`;
 const max=Math.max(0,...(data.savedEstimates||[]).map(q=>q.estimate.number.startsWith(prefix)?Number(q.estimate.number.slice(prefix.length))||0:0));
 return prefix+String(max+1).padStart(4,'0');
}
export function initialiseEstimates(data){
 data.savedEstimates??=[];
 data.estimate??={id:crypto.randomUUID(),number:numberFor(data),date:today(),status:'Borrador'};
 data.commercial??={shipping:0,tax:0,terms:'',validUntil:'',customerDetails:''};
 data.issuer??={name:'',taxId:'',address:'',email:'',phone:''};
 return data;
}
export function validateEstimateFields(q){
 const e=q.estimate,c=q.commercial,i=q.issuer;
 if(!e||typeof e.id!=='string'||!e.id||typeof e.number!=='string'||!e.number.trim()||!dateValid(e.date)||!statuses.includes(e.status))throw Error('Número, fecha o estado de presupuesto no válido');
 if(!c||!Number.isFinite(c.shipping)||c.shipping<0||!Number.isFinite(c.tax)||c.tax<0||c.tax>100||typeof c.terms!=='string'||typeof c.customerDetails!=='string'||(c.validUntil!==''&&!dateValid(c.validUntil)))throw Error('Condiciones económicas no válidas');
 if(c.validUntil && c.validUntil<e.date)throw Error('La validez no puede ser anterior a la fecha del presupuesto');
 if(!i||['name','taxId','address','email','phone'].some(k=>typeof i[k]!=='string'))throw Error('Datos de empresa emisora no válidos');
 return q;
}
export function validateWorkspace(data){
 validate(data);initialiseEstimates(data);validateEstimateFields(data);
 if(!Array.isArray(data.savedEstimates)||data.savedEstimates.length>1000)throw Error('Listado de presupuestos no válido (máximo 1000)');
 const ids=new Set(),numbers=new Set();
 for(const q of data.savedEstimates){
  validateEstimateFields(q);
  if(ids.has(q.estimate.id)||numbers.has(q.estimate.number))throw Error('Presupuestos duplicados');ids.add(q.estimate.id);numbers.add(q.estimate.number);
  if(!Array.isArray(q.lines)||q.lines.some(l=>!l.snapshot)||typeof q.customer!=='string')throw Error('Presupuesto guardado no válido');
  validate({...data,lines:q.lines,selectedTariff:q.selectedTariff});
 }
 if(data.savedEstimates.some(q=>q.estimate.number===data.estimate.number&&q.estimate.id!==data.estimate.id))throw Error('Ya existe otro presupuesto con ese número');
 return data;
}
export function lineAmounts(data,line){
 const unit=unitPrice(lineArticle(data,line),data,line),gross=round(unit*line.quantity),discount=line.discount??0;
 if(!Number.isFinite(discount)||discount<0||discount>100)throw Error('Descuento de línea no válido');
 const deduction=round(gross*discount/100),net=round(gross-deduction);
 if(![unit,gross,deduction,net].every(Number.isFinite))throw Error('Importe fuera de rango');
 return {unit,gross,deduction,net};
}
export function selectEstimateTariff(data,id){
 const next=structuredClone(data);
 const current=next.tariffs.find(t=>t.id===id);
 if(id&&!current&&!next.lines.some(l=>l.snapshot?.tariffs.some(t=>t.id===id)))throw Error('Tarifa no encontrada');
 next.selectedTariff=id;
 if(current)for(const line of next.lines){
  const frozen=freezeLine(next,line);Object.assign(line,frozen);
  line.snapshot.tariffs=line.snapshot.tariffs.filter(t=>t.id!==id);
  line.snapshot.tariffs.push({...structuredClone(current),prices:current.prices.filter(p=>p.article===line.article)});
 }
 validateWorkspace(next);next.lines.forEach(line=>lineAmounts(next,line));return next;
}
export function estimateTotals(data){
 const amounts=data.lines.map(l=>lineAmounts(data,l));
 const gross=round(amounts.reduce((n,a)=>n+a.gross,0)),discount=round(amounts.reduce((n,a)=>n+a.deduction,0)),net=round(gross-discount);
 const shipping=data.commercial?.shipping??0,tax=data.commercial?.tax??0;
 if(!Number.isFinite(shipping)||shipping<0||!Number.isFinite(tax)||tax<0||tax>100)throw Error('Portes o impuesto no válidos');
 const base=round(net+shipping),taxAmount=round(base*tax/100),total=round(base+taxAmount);
 if(![gross,discount,net,base,taxAmount,total].every(Number.isFinite))throw Error('Total fuera de rango');
 return {gross,discount,net,shipping,base,tax,taxAmount,total};
}
export function rememberEstimate(data){
 initialiseEstimates(data);validateEstimateFields(data);
 if(data.savedEstimates.some(q=>q.estimate.number===data.estimate.number&&q.estimate.id!==data.estimate.id))throw Error('Ya existe otro presupuesto con ese número');
 data.lines=data.lines.map(l=>freezeLine(data,l));
 const record=structuredClone({estimate:data.estimate,customer:data.customer,commercial:data.commercial,issuer:data.issuer,lines:data.lines,selectedTariff:data.selectedTariff});
 const index=data.savedEstimates.findIndex(q=>q.estimate.id===data.estimate.id);
 if(index<0 && data.savedEstimates.length>=1000)throw Error('Se ha alcanzado el máximo de 1000 presupuestos guardados en este navegador.');
 if(index<0)data.savedEstimates.push(record);else data.savedEstimates[index]=record;
 return data;
}
export function newEstimate(data){
 const next=structuredClone(data);rememberEstimate(next);
 next.estimate={id:crypto.randomUUID(),number:numberFor(next),date:today(),status:'Borrador'};
 next.customer='';next.lines=[];next.selectedTariff='';next.commercial={shipping:0,tax:0,terms:'',validUntil:'',customerDetails:''};
 return next;
}
export function openEstimate(data,id){
 const next=structuredClone(data);rememberEstimate(next);
 const q=next.savedEstimates.find(q=>q.estimate.id===id);if(!q)throw Error('Presupuesto no encontrado');
 for(const k of ['estimate','customer','commercial','issuer','lines','selectedTariff'])next[k]=structuredClone(q[k]);
 return next;
}
export function duplicateEstimate(data,id=data.estimate.id){
 const next=openEstimate(data,id);next.estimate={id:crypto.randomUUID(),number:numberFor(next),date:today(),status:'Borrador'};next.commercial.validUntil='';return next;
}
export function duplicateLine(data,index){
 if(!data.lines[index])throw Error('Línea no encontrada');
 const line=structuredClone(data.lines[index]);data.lines.splice(index+1,0,line);return data;
}
export function setEstimateStatus(data,id,status){
 if(!statuses.includes(status))throw Error('Estado de presupuesto no válido');
 const next=structuredClone(data);rememberEstimate(next);
 const record=next.savedEstimates.find(q=>q.estimate.id===id);
 if(!record)throw Error('Presupuesto no encontrado');
 record.estimate.status=status;
 if(next.estimate.id===id)next.estimate.status=status;
 return validateWorkspace(next);
}
export function searchArticles(data,query='',family=''){
 const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 const words=normalize(query.trim()).split(/\s+/).filter(Boolean);
 return data.articles.filter(a=>(!family||a.family===family)&&words.every(w=>normalize(`${a.id} ${a.name} ${data.families.find(f=>f.id===a.family)?.name||''}`).includes(w)));
}

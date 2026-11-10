import {validateWorkspace, rememberEstimate} from './estimates.js';
export const companyKey = 'imatia-companies-v1';
export function emptyCompany(name) {
  return validateWorkspace({customer:'',parameters:[],families:[],articles:[],lines:[],tariffs:[],selectedTariff:'',issuer:{name,taxId:'',address:'',email:'',phone:''}});
}
export function loadCompanies(storage, legacy) {
  const raw=storage.getItem(companyKey);
  if (!raw) return {active:'original',companies:[{id:'original',name:legacy.issuer?.name||'Mi empresa',workspace:structuredClone(legacy)}]};
  const state=JSON.parse(raw);
  if(!Array.isArray(state.companies)||!state.companies.length||!state.companies.some(c=>c.id===state.active))throw Error('Configuración de empresas no válida');
  const ids=new Set();
  for(const c of state.companies){if(!c.id||typeof c.name!=='string'||!c.name.trim()||ids.has(c.id))throw Error('Empresa no válida');ids.add(c.id);validateWorkspace(c.workspace);}
  return state;
}
export function persistCompanies(storage,state,workspace) {
  const next=structuredClone(state),company=next.companies.find(c=>c.id===next.active);
  if(!company)throw Error('Selecciona una empresa');
  validateWorkspace(workspace);rememberEstimate(workspace);company.workspace=structuredClone(workspace);
  storage.setItem(companyKey,JSON.stringify(next));
  // Compatibility copy only. The company collection is the authoritative save.
  try{storage.setItem('elastic-parametric-v1',JSON.stringify(workspace));}catch{}
  return next;
}
export function addCompany(state,name,workspace=emptyCompany(name)) {
  name=name.trim();if(!name||name.length>100)throw Error('Indica un nombre de empresa de hasta 100 caracteres');
  if(state.companies.some(c=>c.name.toLowerCase()===name.toLowerCase()))throw Error('Ya existe una empresa con ese nombre');
  const next=structuredClone(state),id=crypto.randomUUID();
  next.companies.push({id,name,workspace:structuredClone(workspace)});next.active=id;return next;
}
export function removeCompany(state,id) {
  if(!state.companies.some(c=>c.id===id))throw Error('Empresa no encontrada');
  const next=structuredClone(state);
  next.companies=next.companies.filter(c=>c.id!==id);
  if(!next.companies.length){const freshId=crypto.randomUUID();next.companies=[{id:freshId,name:'Mi empresa',workspace:emptyCompany('Mi empresa')}];}
  if(next.active===id)next.active=next.companies[0].id;
  return next;
}

import {createHistory} from './editing.js';
import {loadCompanies,persistCompanies,addCompany,removeCompany,emptyCompany} from './companies.js';
import {demoBusinesses,demoWorkspace} from './demo-businesses.js';
import {setupEditingUi} from './editing-ui.js';
import {setupEstimateUi} from './estimate-ui.js';
import {validateWorkspace as validate,selectEstimateTariff,rememberEstimate,freezeLine,lineArticle,lineParameters,lineAmounts,estimateTotals} from './estimates.js';
import {setupWorkflows} from './workflows.js';
import {validateCatalog, unitPrice, familyParameters, defaultValues, reconcileLines} from './model.js';
const key='elastic-parametric-v1';
const seed={customer:'',parameters:[{id:'ancho',name:'Ancho (m)',type:'number',value:1,options:[]},{id:'alto',name:'Alto (m)',type:'number',value:2,options:[]}],families:[{id:'PANELES',name:'Paneles',parameters:['ancho','alto']},{id:'SERVICIOS',name:'Servicios',parameters:[]}],articles:[{id:'panel',name:'Panel a medida',family:'PANELES',formula:'ancho * alto * 45'},{id:'montaje',name:'Servicio de montaje',family:'SERVICIOS',formula:'35'}],lines:[{article:'panel',quantity:1,values:{ancho:1,alto:2}}]};
let data=validate(structuredClone(seed)),view='quote';
const notice=message=>{document.querySelector('#notice').textContent=message;};
try{const saved=localStorage.getItem(key);if(saved){const parsed=JSON.parse(saved),legacy=!parsed.families;data=validate(parsed);if(legacy)notice('Datos convertidos: los valores anteriores se han copiado a cada línea dentro de la familia General.');}}catch{notice('No se pudieron cargar los datos guardados. Se muestra el ejemplo.');}
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value);
rememberEstimate(data);
const history=createHistory();
const menuPreference='imatia-menu-collapsed';
function setMenuCollapsed(collapsed,{save=true}={}){
 document.body.classList.toggle('menu-collapsed',collapsed);
 document.querySelector('#sidebar').hidden=collapsed;
 const toggle=document.querySelector('#menu-toggle');toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-label',collapsed?'Mostrar menú':'Ocultar menú');toggle.title=collapsed?'Mostrar menú':'Ocultar menú';
 if(save)try{localStorage.setItem(menuPreference,String(collapsed));}catch{}
}
try{const saved=localStorage.getItem(menuPreference);setMenuCollapsed(saved===null?Boolean(document.defaultView.matchMedia?.('(max-width:700px)').matches):saved==='true',{save:false});}catch{setMenuCollapsed(false,{save:false});}
document.querySelector('#menu-toggle').addEventListener('click',()=>setMenuCollapsed(!document.body.classList.contains('menu-collapsed')));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.body.classList.contains('menu-collapsed')){setMenuCollapsed(true);document.querySelector('#menu-toggle').focus();}});
let companies;
let companyStorageError=false;
try{companies=loadCompanies(localStorage,data);data=structuredClone(companies.companies.find(c=>c.id===companies.active).workspace);}catch{companyStorageError=true;notice('No se pueden leer las empresas guardadas. Recarga o recupera los datos del navegador antes de continuar.');companies={active:'original',companies:[{id:'original',name:'Mi empresa',workspace:structuredClone(data)}]};}
function saveCompanyState(next,workspace){
 if(companyStorageError)throw Error('No se guardarán cambios mientras la configuración de empresas no pueda recuperarse.');
 try{return persistCompanies(localStorage,next,workspace);}catch(error){throw Error('No se pudo guardar la empresa. Revisa el espacio del navegador. '+error.message);}
}
function activateCompany(next){
 const workspace=structuredClone(next.companies.find(c=>c.id===next.active).workspace);
 const saved=saveCompanyState(next,workspace);
 companies=saved;data=workspace;history.clear();editingUi.clear();workflows.clear();view='quote';render();notice('Empresa activa: '+companies.companies.find(c=>c.id===companies.active).name);
}
function companiesView(){return `<div class="card"><h2>Empresas de la demo</h2><p>Cada empresa conserva su catálogo, presupuestos y datos de emisión. Los datos se guardan en este navegador.</p>${companies.companies.map(c=>`<div class="row"><strong>${esc(c.name)}</strong><div class="actions"><button data-open-company="${esc(c.id)}" ${c.id===companies.active?'disabled':''}>${c.id===companies.active?'Activa':'Abrir empresa'}</button><button class="danger" data-delete-company="${esc(c.id)}">Eliminar empresa</button></div></div>`).join('')}</div><form class="card" id="company-form"><h2>Crear empresa</h2><label>Nombre de empresa<input name="companyName" maxlength="100" required></label><button class="primary">Crear empresa vacía</button></form><form class="card" id="company-name-form"><h2>Nombre de la empresa activa</h2><label>Nombre<input name="companyName" maxlength="100" required value="${esc(companies.companies.find(c=>c.id===companies.active).name)}"></label><button>Guardar nombre</button><p>Los datos fiscales y comerciales del PDF se configuran en el presupuesto.</p></form><div class="card"><h2>Negocios de ejemplo</h2><p>Precios ficticios para pruebas, sin impuestos ni validez comercial. Cada demo incluye siete servicios, parámetros configurables y un presupuesto inicial. Cargarla crea una empresa separada y conserva las anteriores.</p>${Object.entries(demoBusinesses).map(([kind,d])=>`<div class="row"><strong>${esc(d.name)}</strong><div><button data-demo-company="${kind}">Crear empresa de ejemplo</button> <a href="/examples/${d.file}" download>Descargar Excel</a></div></div>`).join('')}</div>`;}
function updateUndo(){const button=document.querySelector('#undo');button.disabled=!history.size;button.title=history.size?'Deshacer el último cambio guardado':'No hay cambios para deshacer en esta sesión';}
function commit(next,{recordUndo=true,resetHistory=false}={}){
 validate(next);rememberEstimate(next);
 const serialized=JSON.stringify(next),changed=serialized!==JSON.stringify(data);
 companies=saveCompanyState(companies,next);
 if(resetHistory)history.clear();else if(changed&&recordUndo)history.push({data,view});
 data=next;notice('');updateUndo();
}
function undo(){const previous=history.peek();if(!previous)return;commit(previous.data,{recordUndo:false});history.pop();view=previous.view;editingUi.clear();render();notice('Última acción deshecha.');}
const editingUi=setupEditingUi({getData:()=>data,commit,render,notice,esc,money});
const estimateUi=setupEstimateUi({getData:()=>data,commit,render,notice,esc,money,setView:next=>{view=next;}});
const workflows=setupWorkflows({getData:()=>data,commit,esc,notice,render});
const familyName=id=>data.families.find(f=>f.id===id)?.name||id;
const familyOptions=()=>data.families.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
function parameterInput(p,line,index){
 const value=line.values[p.id],wide=p.type==='text';
 return `<label class="parameter-field ${wide?'parameter-field-wide':''}" title="Identificador: ${esc(p.id)}"><span class="parameter-label">${esc(p.name)}</span>${p.type==='select'?`<select data-line="${index}" data-param="${esc(p.id)}">${p.options.map(o=>`<option value="${esc(o)}" ${o===value?'selected':''}>${esc(editingUi.optionCaption(p,o))}</option>`).join('')}</select>`:`<input data-line="${index}" data-param="${esc(p.id)}" type="${p.type}" ${p.type==='number'?'step="any"':''} value="${esc(value)}">`}</label>`;
}
function quoteView(){
 editingUi.sync();
 let invalid=false,total=0;
 const rows=data.lines.map((line,index)=>{
  const article=lineArticle(data,line);let unit,subtotal;
  try{const amounts=lineAmounts(data,line);unit=amounts.unit;subtotal=amounts.net;}catch(error){invalid=true;unit=error.message;}
  const parameters=lineParameters(data,line);
  return `<tr class="article-row"><td>${editingUi.selectionInput(index)}<strong>${esc(article.name)}</strong><small>${esc(line.snapshot?.familyName||familyName(article.family))} · ${esc(article.id)}</small></td><td><input aria-label="Cantidad línea ${index+1}" class="quantity-input" type="number" min="0.001" step="any" data-quantity="${index}" value="${line.quantity}"></td><td>${typeof unit==='number'?`<input type="number" min="0" step="0.01" data-manual-price="${index}" aria-label="Precio unitario línea ${index+1}" value="${unit}"><small>${line.manualPrice!==undefined?'Precio manual':'Precio calculado'}</small>${line.manualPrice!==undefined?`<button type="button" data-reset-price="${index}">Volver al calculado</button>`:''}`:`<span class="error">${esc(unit)}</span>`}</td><td>${subtotal===undefined?'—':money(subtotal)}</td><td><div class="line-actions"><button data-duplicate-line="${index}" aria-label="Duplicar línea ${index+1}" title="Duplicar línea">⧉</button><button class="danger" data-delete-line="${index}" aria-label="Eliminar línea ${index+1}">×</button></div></td></tr><tr class="line-configuration"><td colspan="5"><div class="muted">Configuración de la línea ${index+1}</div><div class="fields">${parameters.map(p=>parameterInput(p,line,index)).join('')}<label class="parameter-field"><span class="parameter-label">Descuento línea (%)</span><input type="number" min="0" max="100" step="any" data-line-discount="${index}" value="${line.discount??0}"></label></div></td></tr>`;
 }).join('');
 try{total=estimateTotals(data).total;}catch{invalid=true;}
 const summary=`<div class="quote-summary" aria-label="Total del presupuesto"><div><span class="summary-label">TOTAL PRESUPUESTO</span><div class="total" aria-live="polite">${invalid?'Pendiente':money(total)}</div></div><div class="summary-meta"><strong>${data.lines.length} líneas</strong><span>EUR · Impuestos incluidos</span></div><button class="primary" data-pdf type="button">Imprimir</button></div>`;
 const body=`<div class="quote-layout">${estimateUi.metadataView()}<div class="card quote-lines"><h2>Artículos y configuración</h2><p class="muted">Cada línea conserva su configuración y su regla de precio. Duplica una línea para preparar variantes.</p>${editingUi.toolbar()}<div class="quote-table-scroll"><table class="quote-table"><colgroup><col class="col-article"><col class="col-quantity"><col class="col-price"><col class="col-amount"><col class="col-action"></colgroup><thead><tr><th>Artículo / Familia</th><th>Cantidad</th><th>Precio unit.</th><th>Importe neto</th><th>Acciones</th></tr></thead><tbody>${rows}</tbody></table></div>${estimateUi.searchBar('quote')}<form id="line-form" class="add-line-form"><label>Añadir artículo<select name="article">${estimateUi.articleOptions()}</select></label><button class="primary" ${!estimateUi.filtered('quote').length?'disabled':''}>+ Añadir al presupuesto</button></form></div>${estimateUi.economicView()}</div>`;
 return {body,summary};
}
function familiesView(){return `<div class="card"><h2>Familias de artículos</h2>${data.families.map(f=>`<div class="row"><div><strong>${esc(f.name)}</strong><p><code>${esc(f.id)}</code> · ${f.parameters.map(id=>esc(data.parameters.find(p=>p.id===id)?.name)).join(', ')||'Sin parámetros'}</p></div><div><button data-edit-family="${esc(f.id)}">Editar</button> <button class="danger" data-delete-family="${esc(f.id)}">Eliminar</button></div></div>`).join('')||'<p>Crea la primera familia.</p>'}</div><form class="card" id="family-form"><h2>Crear o editar familia</h2><div class="fields"><label>Código<input name="id" required></label><label>Nombre<input name="name" required></label></div><h3>Parámetros de esta familia</h3><div class="parameter-choices">${data.parameters.map(p=>`<label><input type="checkbox" name="parameters" value="${esc(p.id)}"> ${esc(p.name)} <code>${esc(p.id)}</code></label>`).join('')||'<p>Crea primero los parámetros que necesites.</p>'}</div><p class="muted">Los valores iniciales se definen en Parámetros. Cambiar la selección conserva los valores compatibles de las líneas y añade los nuevos con su valor inicial.</p><button class="primary">Guardar familia</button> <button type="button" data-reset-form="family-form">Nueva familia</button></form>`;}
function parametersView(){return `<div class="card"><h2>Definiciones de parámetros</h2><p>Estos valores son los iniciales para nuevas líneas. Las líneas existentes conservan su configuración.</p>${data.parameters.map(p=>`<div class="row"><div><strong>${esc(p.name)}</strong><p><code>${esc(p.id)}</code> · ${esc(p.type)} · Inicial: ${esc(p.value)}</p></div><div><button data-edit-param="${esc(p.id)}">Editar</button> <button class="danger" data-delete-param="${esc(p.id)}">Eliminar</button></div></div>`).join('')}</div><form class="card" id="parameter-form"><h2>Crear o editar parámetro</h2><div class="fields"><label>Nombre<input name="name" required></label><label>Identificador<input name="id" required pattern="[a-zA-Z_][a-zA-Z_0-9]*"></label><label>Tipo<select name="type"><option value="number">Número</option><option value="text">Texto</option><option value="select">Lista</option></select></label><label>Valor inicial<input name="value"></label><label>Opciones separadas por comas<input name="options"></label></div>${editingUi.pricingEditor()}<button class="primary">Guardar parámetro</button> <button type="button" data-reset-form="parameter-form">Nuevo parámetro</button></form>`;}
function articlesView(){return `<div class="card"><h2>Catálogo</h2>${estimateUi.searchBar('catalog')}<div id="catalog-results">${estimateUi.catalogCards()}</div></div><form class="card" id="article-form"><h2>Crear o editar artículo</h2><input name="id" type="hidden"><div class="fields"><label>Nombre<input name="name" required></label><label>Familia<select name="family" required>${familyOptions()}</select></label><label>Precio fijo o fórmula<input name="formula" required placeholder="Ej.: 50 (precio fijo)"></label></div><p class="muted">Precio fijo: escribe un importe, por ejemplo 50. Para calcularlo con una fórmula, combina los parámetros de la familia usando el asistente de abajo. Puedes utilizar +, -, *, / y paréntesis. No escribas = al inicio. El resultado es el precio de una unidad.</p>${estimateUi.formulaAssistant()}<button class="primary" ${!data.families.length?'disabled':''}>Guardar artículo</button> <button type="button" data-reset-form="article-form">Nuevo artículo</button></form>`;}
function render(){
 const configuration=document.querySelector('#configuration-nav');
 if(configuration){const active=['articles','families','parameters','tariffs','imports'].includes(view);configuration.classList.toggle('contains-active',active);if(active)configuration.open=true;}
 const selector=document.querySelector('#company-select');
 if(selector)selector.innerHTML=companies.companies.map(c=>`<option value="${esc(c.id)}" ${c.id===companies.active?'selected':''}>${esc(c.name)}</option>`).join('');
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 const pages={estimates:['Mis presupuestos','Busca, recupera o duplica presupuestos guardados en este navegador.',estimateUi.listView],quote:['Presupuesto','Configura cada artículo con sus propios valores.',quoteView],parameters:['Parámetros','Define los campos y los valores iniciales de configuración.',parametersView],families:['Familias','Asigna a cada familia los parámetros que necesitan sus artículos.',familiesView],articles:['Artículos','Clasifica tu catálogo por familias y define las fórmulas.',articlesView],tariffs:['Tarifas','Configura precios y condiciones comerciales.',workflows.tariffsView],imports:['Importación de datos','Carga parámetros, familias, artículos y tarifas.',workflows.importView]};
 pages.companies=['Empresas','Configura y prueba negocios independientes.',companiesView];
 const page=pages[view],content=page[2](),quote=view==='quote';
 document.querySelector('#content').innerHTML=`<div class="page-heading ${quote?'quote-heading':''}"><div class="heading"><div class="eyebrow">CONFIGURADOR PARAMÉTRICO</div><h1>${page[0]}</h1><p>${page[1]}</p></div>${quote?content.summary:''}</div>${quote?content.body:content}`;
 if(view==='articles')estimateUi.updateFormulaAssistant();
 if(view==='parameters')editingUi.updatePricingEditor();
 updateUndo();
}
function saveCatalog(next){reconcileLines(next);validate(next);validateCatalog(next);commit(next);render();}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 try{
  if(b.dataset.deleteCompany){
   const company=companies.companies.find(c=>c.id===b.dataset.deleteCompany);if(!company)throw Error('Empresa no encontrada');
   const last=companies.companies.length===1;
   if(!confirm('¿Eliminar la empresa "'+company.name+'"? Se borrarán su catálogo, parámetros y todos sus presupuestos de este navegador. Esta acción no se puede deshacer.'+(last?' Se creará una empresa vacía para continuar.':'')))return;
   const next=removeCompany(companies,company.id),workspace=structuredClone(next.companies.find(c=>c.id===next.active).workspace);
   const saved=saveCompanyState(next,workspace);
   companies=saved;data=workspace;history.clear();editingUi.clear();workflows.clear();render();notice('Empresa eliminada: '+company.name);return;
  }
  if(b.dataset.openCompany){activateCompany({...companies,active:b.dataset.openCompany});return;}
  if(b.dataset.demoCompany){const demo=demoBusinesses[b.dataset.demoCompany];let name=demo.name,n=2;while(companies.companies.some(c=>c.name.toLowerCase()===name.toLowerCase()))name=demo.name+' '+n++;const workspace=demoWorkspace(b.dataset.demoCompany);workspace.issuer.name=name;activateCompany(addCompany(companies,name,workspace));return;}
  if(b.dataset.resetPrice!==undefined){const next=structuredClone(data);delete next.lines[Number(b.dataset.resetPrice)].manualPrice;estimateTotals(next);commit(next);render();return;}
  if(b.id==='undo'){undo();return;}
  if(b.dataset.view){view=b.dataset.view;render();return;}
  if(b.dataset.resetForm){const f=document.getElementById(b.dataset.resetForm);f.reset();f.elements.id.value='';f.elements.id.readOnly=false;if(f.id==='article-form')estimateUi.updateFormulaAssistant();if(f.id==='parameter-form')editingUi.updatePricingEditor();return;}
  const next=structuredClone(data);
  if(b.dataset.deleteLine!==undefined){next.lines.splice(Number(b.dataset.deleteLine),1);commit(next);render();}
  if(b.dataset.editParam){const p=data.parameters.find(p=>p.id===b.dataset.editParam),f=document.querySelector('#parameter-form');for(const k of ['id','name','type','value'])f.elements[k].value=p[k];f.elements.options.value=p.options.join(', ');f.elements.id.readOnly=true;editingUi.updatePricingEditor(p);f.elements.name.focus();}
  if(b.dataset.deleteParam){if(data.families.some(f=>f.parameters.includes(b.dataset.deleteParam)))throw Error('El parámetro está asignado a una familia. Retíralo de la familia antes de eliminarlo.');next.parameters=next.parameters.filter(p=>p.id!==b.dataset.deleteParam);saveCatalog(next);}
  if(b.dataset.editFamily){const family=data.families.find(f=>f.id===b.dataset.editFamily),f=document.querySelector('#family-form');f.elements.id.value=family.id;f.elements.id.readOnly=true;f.elements.name.value=family.name;f.querySelectorAll('[name="parameters"]').forEach(el=>{el.checked=family.parameters.includes(el.value);});f.elements.name.focus();}
  if(b.dataset.deleteFamily){if(data.articles.some(a=>a.family===b.dataset.deleteFamily))throw Error('La familia tiene artículos. Reclasifícalos antes de eliminarla.');next.families=next.families.filter(f=>f.id!==b.dataset.deleteFamily);saveCatalog(next);}
  if(b.dataset.editArticle){const a=data.articles.find(a=>a.id===b.dataset.editArticle),f=document.querySelector('#article-form');for(const k of ['id','name','family','formula'])f.elements[k].value=a[k];estimateUi.updateFormulaAssistant();f.elements.name.focus();}
  if(b.dataset.deleteArticle){if(data.lines.some(l=>l.article===b.dataset.deleteArticle)||data.tariffs.some(t=>t.prices.some(p=>p.article===b.dataset.deleteArticle)))throw Error('El artículo tiene líneas o precios de tarifa. Retíralos antes de eliminarlo.');next.articles=next.articles.filter(a=>a.id!==b.dataset.deleteArticle);saveCatalog(next);}
 }catch(error){notice(error.message);}
});
document.addEventListener('change',e=>{
 const el=e.target,next=structuredClone(data);
 try{
  if(el.id==='company-select'){activateCompany({...companies,active:el.value});return;}
  if(el.dataset.param){const line=next.lines[Number(el.dataset.line)],p=lineParameters(next,line).find(p=>p.id===el.dataset.param);if(!p)throw Error('Parámetro ajeno a la familia');if(p.type==='number'&&(el.value===''||!Number.isFinite(Number(el.value))))throw Error('Introduce un número válido');line.values[p.id]=p.type==='number'?Number(el.value):el.value;validate(next);commit(next);render();}
  if(el.dataset.quantity!==undefined){const n=Number(el.value);if(!Number.isFinite(n)||n<=0)throw Error('La cantidad debe ser mayor que cero');next.lines[Number(el.dataset.quantity)].quantity=n;commit(next);render();}
  if(el.id==='selected-tariff'){commit(selectEstimateTariff(data,el.value));render();}
  if(el.dataset.manualPrice!==undefined){if(el.value===''||!Number.isFinite(Number(el.value))||Number(el.value)<0)throw Error('Introduce un precio mayor o igual que cero');next.lines[Number(el.dataset.manualPrice)].manualPrice=Number(el.value);estimateTotals(next);commit(next);render();}
  if(el.id==='customer'){next.customer=el.value;commit(next);}
 }catch(error){if(el.dataset.manualPrice!==undefined||el.id==='selected-tariff')render();notice(error.message);}
});
document.addEventListener('submit',e=>{
 if(['company-form','company-name-form'].includes(e.target.id)){
  e.preventDefault();try{const name=new FormData(e.target).get('companyName').trim();if(e.target.id==='company-form'){activateCompany(addCompany(companies,name,emptyCompany(name)));}else{if(!name||name.length>100||companies.companies.some(c=>c.id!==companies.active&&c.name.toLowerCase()===name.toLowerCase()))throw Error('Nombre vacío o ya utilizado');const next=structuredClone(companies);next.companies.find(c=>c.id===next.active).name=name;companies=saveCompanyState(next,data);render();}}catch(error){notice(error.message);}return;
 }
 const f=e.target;if(!['parameter-form','family-form','article-form','line-form'].includes(f.id))return;e.preventDefault();
 const fd=new FormData(f),v=Object.fromEntries(fd),next=structuredClone(data);
 const upsert=(list,item)=>{const i=list.findIndex(x=>x.id===item.id);if(i<0)list.push(item);else list[i]=item;};
 try{
  if(f.id==='parameter-form'){
   const id=v.id.trim(),options=v.options.split(',').map(x=>x.trim()).filter(Boolean);if(next.parameters.some(p=>p.id===id)&&!f.elements.id.readOnly)throw Error('El identificador ya existe; utiliza Editar');
   if(v.type==='number'&&(v.value.trim()===''||!Number.isFinite(Number(v.value))))throw Error('Valor inicial numérico obligatorio');
   if(v.type==='select'&&!options.includes(v.value))throw Error('El valor inicial debe estar en las opciones');
   const optionPricing=editingUi.readPricing(f,options,v.type);
   upsert(next.parameters,{id,name:v.name.trim(),type:v.type,options,value:v.type==='number'?Number(v.value):v.value,...(optionPricing?{optionPricing}:{})});
  }
  if(f.id==='family-form'){const id=v.id.trim();if(next.families.some(x=>x.id===id)&&!f.elements.id.readOnly)throw Error('El código ya existe; utiliza Editar');upsert(next.families,{id,name:v.name.trim(),parameters:fd.getAll('parameters')});}
  if(f.id==='article-form')upsert(next.articles,{id:v.id||crypto.randomUUID(),name:v.name.trim(),family:v.family,formula:v.formula.trim()});
  if(f.id==='line-form'){const article=next.articles.find(a=>a.id===v.article);if(!article)throw Error('Selecciona un artículo');next.lines.push(freezeLine(next,{article:article.id,quantity:1,values:defaultValues(article,next),discount:0}));}
  saveCatalog(next);
 }catch(error){notice(error.message);}
});
render();

document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&!event.shiftKey&&!event.altKey&&event.key.toLowerCase()==='z'&&!event.target.closest?.('input,textarea,select,[contenteditable="true"]')){event.preventDefault();try{undo();}catch(error){notice(error.message);}}});

import {setupWorkflows} from './workflows.js';
import {validate, validateCatalog, unitPrice, familyParameters, defaultValues, reconcileLines} from './model.js';
const key='elastic-parametric-v1';
const seed={customer:'',parameters:[{id:'ancho',name:'Ancho (m)',type:'number',value:1,options:[]},{id:'alto',name:'Alto (m)',type:'number',value:2,options:[]}],families:[{id:'PANELES',name:'Paneles',parameters:['ancho','alto']},{id:'SERVICIOS',name:'Servicios',parameters:[]}],articles:[{id:'panel',name:'Panel a medida',family:'PANELES',formula:'ancho * alto * 45'},{id:'montaje',name:'Servicio de montaje',family:'SERVICIOS',formula:'35'}],lines:[{article:'panel',quantity:1,values:{ancho:1,alto:2}}]};
let data=validate(structuredClone(seed)),view='quote';
const notice=message=>{document.querySelector('#notice').textContent=message;};
try{const saved=localStorage.getItem(key);if(saved){const parsed=JSON.parse(saved),legacy=!parsed.families;data=validate(parsed);if(legacy)notice('Datos convertidos: los valores anteriores se han copiado a cada línea dentro de la familia General.');}}catch{notice('No se pudieron cargar los datos guardados. Se muestra el ejemplo.');}
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value);
function save(){try{localStorage.setItem(key,JSON.stringify(data));notice('');}catch{notice('No se pudo guardar. Exporta JSON para conservar tus cambios.');}}
function commit(next){data=next;save();}
const workflows=setupWorkflows({getData:()=>data,commit,esc,notice,render});
const familyName=id=>data.families.find(f=>f.id===id)?.name||id;
const familyOptions=()=>data.families.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
function parameterInput(p,line,index){
 const value=line.values[p.id],wide=p.type==='text';
 return `<label class="parameter-field ${wide?'parameter-field-wide':''}" title="Identificador: ${esc(p.id)}"><span class="parameter-label">${esc(p.name)}</span>${p.type==='select'?`<select data-line="${index}" data-param="${esc(p.id)}">${p.options.map(o=>`<option ${o===value?'selected':''}>${esc(o)}</option>`).join('')}</select>`:`<input data-line="${index}" data-param="${esc(p.id)}" type="${p.type}" ${p.type==='number'?'step="any"':''} value="${esc(value)}">`}</label>`;
}
function quoteView(){
 let total=0,invalid=false;
 const rows=data.lines.map((line,index)=>{
  const article=data.articles.find(a=>a.id===line.article);let unit,subtotal;
  try{unit=unitPrice(article,data,line);subtotal=Math.round(unit*line.quantity*100)/100;if(!Number.isFinite(subtotal))throw Error('Importe fuera de rango');total+=subtotal;}catch(error){invalid=true;unit=error.message;}
  const parameters=familyParameters(article,data);
  return `<tr class="article-row"><td><strong>${esc(article.name)}</strong><small>${esc(familyName(article.family))} · ${esc(article.id)}</small></td><td><input aria-label="Cantidad línea ${index+1}" class="quantity-input" type="number" min="0.001" step="any" data-quantity="${index}" value="${line.quantity}"></td><td>${typeof unit==='number'?money(unit):`<span class="error">${esc(unit)}</span>`}</td><td>${subtotal===undefined?'—':money(subtotal)}</td><td><button class="danger" data-delete-line="${index}" aria-label="Eliminar línea ${index+1}">×</button></td></tr><tr class="line-configuration"><td colspan="5"><div class="muted">Configuración de la línea ${index+1} · ${esc(familyName(article.family))}</div><div class="fields">${parameters.map(p=>parameterInput(p,line,index)).join('')||'<p class="muted">Esta familia no requiere parámetros.</p>'}</div></td></tr>`;
 }).join('');
 const summary=`<div class="quote-summary" aria-label="Total del presupuesto"><div><span class="summary-label">TOTAL PRESUPUESTO</span><div class="total" aria-live="polite">${invalid||!Number.isFinite(total)?'Pendiente':money(total)}</div></div><div class="summary-meta"><strong>${data.lines.length} líneas</strong><span>EUR · Sin impuestos</span></div>${invalid?'<p class="summary-error">Revisa las líneas con errores.</p>':''}</div>`;
 const body=`<div class="quote-layout"><div class="card quote-data"><h2>Datos del presupuesto</h2><div class="fields"><label>Cliente o referencia<input id="customer" value="${esc(data.customer)}" placeholder="Cliente / Proyecto"></label><label>Tarifa comercial<select id="selected-tariff"><option value="">Precio base (sin tarifa)</option>${data.tariffs.map(t=>`<option value="${esc(t.id)}" ${data.selectedTariff===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label></div></div><div class="card quote-lines"><h2>Artículos y configuración</h2><p class="muted">Cada línea tiene sus propios valores. Puedes añadir el mismo artículo varias veces con medidas diferentes.</p><div class="quote-table-scroll"><table class="quote-table"><colgroup><col class="col-article"><col class="col-quantity"><col class="col-price"><col class="col-amount"><col class="col-action"></colgroup><thead><tr><th>Artículo / Familia</th><th>Cantidad</th><th>Precio unit.</th><th>Importe</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${rows}</tbody></table></div>${!rows?'<p>Añade el primer artículo.</p>':''}<form id="line-form" class="add-line-form"><label>Añadir artículo<select name="article">${data.articles.map(a=>`<option value="${esc(a.id)}">${esc(a.id)} · ${esc(a.name)} (${esc(familyName(a.family))})</option>`).join('')}</select></label><button class="primary" ${!data.articles.length?'disabled':''}>+ Añadir al presupuesto</button></form></div></div>`;
 return {body,summary};
}
function familiesView(){return `<div class="card"><h2>Familias de artículos</h2>${data.families.map(f=>`<div class="row"><div><strong>${esc(f.name)}</strong><p><code>${esc(f.id)}</code> · ${f.parameters.map(id=>esc(data.parameters.find(p=>p.id===id)?.name)).join(', ')||'Sin parámetros'}</p></div><div><button data-edit-family="${esc(f.id)}">Editar</button> <button class="danger" data-delete-family="${esc(f.id)}">Eliminar</button></div></div>`).join('')||'<p>Crea la primera familia.</p>'}</div><form class="card" id="family-form"><h2>Crear o editar familia</h2><div class="fields"><label>Código<input name="id" required></label><label>Nombre<input name="name" required></label></div><h3>Parámetros de esta familia</h3><div class="parameter-choices">${data.parameters.map(p=>`<label><input type="checkbox" name="parameters" value="${esc(p.id)}"> ${esc(p.name)} <code>${esc(p.id)}</code></label>`).join('')||'<p>Crea primero los parámetros que necesites.</p>'}</div><p class="muted">Los valores iniciales se definen en Parámetros. Cambiar la selección conserva los valores compatibles de las líneas y añade los nuevos con su valor inicial.</p><button class="primary">Guardar familia</button> <button type="button" data-reset-form="family-form">Nueva familia</button></form>`;}
function parametersView(){return `<div class="card"><h2>Definiciones de parámetros</h2><p>Estos valores son los iniciales para nuevas líneas. Las líneas existentes conservan su configuración.</p>${data.parameters.map(p=>`<div class="row"><div><strong>${esc(p.name)}</strong><p><code>${esc(p.id)}</code> · ${esc(p.type)} · Inicial: ${esc(p.value)}</p></div><div><button data-edit-param="${esc(p.id)}">Editar</button> <button class="danger" data-delete-param="${esc(p.id)}">Eliminar</button></div></div>`).join('')}</div><form class="card" id="parameter-form"><h2>Crear o editar parámetro</h2><div class="fields"><label>Nombre<input name="name" required></label><label>Identificador<input name="id" required pattern="[a-zA-Z_][a-zA-Z_0-9]*"></label><label>Tipo<select name="type"><option value="number">Número</option><option value="text">Texto</option><option value="select">Lista</option></select></label><label>Valor inicial<input name="value"></label><label>Opciones separadas por comas<input name="options"></label></div><button class="primary">Guardar parámetro</button> <button type="button" data-reset-form="parameter-form">Nuevo parámetro</button></form>`;}
function articlesView(){return `<div class="card"><h2>Catálogo</h2>${data.articles.map(a=>`<div class="row"><div><strong>${esc(a.name)}</strong><p>${esc(familyName(a.family))} · <code>${esc(a.formula)}</code></p></div><div><button data-edit-article="${esc(a.id)}">Editar</button> <button class="danger" data-delete-article="${esc(a.id)}">Eliminar</button></div></div>`).join('')}</div><form class="card" id="article-form"><h2>Crear o editar artículo</h2><input name="id" type="hidden"><div class="fields"><label>Nombre<input name="name" required></label><label>Familia<select name="family" required>${familyOptions()}</select></label><label>Precio fijo o fórmula<input name="formula" required placeholder="ancho * alto * 45"></label></div><p class="muted">Utiliza únicamente parámetros numéricos de la familia seleccionada. Los precios de tarifa deben cumplir la misma regla.</p><button class="primary" ${!data.families.length?'disabled':''}>Guardar artículo</button> <button type="button" data-reset-form="article-form">Nuevo artículo</button></form>`;}
function render(){
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 const pages={quote:['Presupuesto','Configura cada artículo con sus propios valores.',quoteView],parameters:['Parámetros','Define los campos y los valores iniciales de configuración.',parametersView],families:['Familias','Asigna a cada familia los parámetros que necesitan sus artículos.',familiesView],articles:['Artículos','Clasifica tu catálogo por familias y define las fórmulas.',articlesView],tariffs:['Tarifas','Configura precios y condiciones comerciales.',workflows.tariffsView],imports:['Importar Excel','Carga parámetros, familias, artículos y tarifas.',workflows.importView]};
 const page=pages[view],content=page[2](),quote=view==='quote';
 document.querySelector('#content').innerHTML=`<div class="page-heading ${quote?'quote-heading':''}"><div class="heading"><div class="eyebrow">CONFIGURADOR PARAMÉTRICO</div><h1>${page[0]}</h1><p>${page[1]}</p></div>${quote?content.summary:''}</div>${quote?content.body:content}`;
}
function saveCatalog(next){reconcileLines(next);validate(next);validateCatalog(next);commit(next);render();}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 try{
  if(b.dataset.view){view=b.dataset.view;render();return;}
  if(b.dataset.resetForm){const f=document.getElementById(b.dataset.resetForm);f.reset();f.elements.id.value='';f.elements.id.readOnly=false;return;}
  const next=structuredClone(data);
  if(b.dataset.deleteLine!==undefined){next.lines.splice(Number(b.dataset.deleteLine),1);commit(next);render();}
  if(b.dataset.editParam){const p=data.parameters.find(p=>p.id===b.dataset.editParam),f=document.querySelector('#parameter-form');for(const k of ['id','name','type','value'])f.elements[k].value=p[k];f.elements.options.value=p.options.join(', ');f.elements.id.readOnly=true;f.elements.name.focus();}
  if(b.dataset.deleteParam){if(data.families.some(f=>f.parameters.includes(b.dataset.deleteParam)))throw Error('El parámetro está asignado a una familia. Retíralo de la familia antes de eliminarlo.');next.parameters=next.parameters.filter(p=>p.id!==b.dataset.deleteParam);saveCatalog(next);}
  if(b.dataset.editFamily){const family=data.families.find(f=>f.id===b.dataset.editFamily),f=document.querySelector('#family-form');f.elements.id.value=family.id;f.elements.id.readOnly=true;f.elements.name.value=family.name;f.querySelectorAll('[name="parameters"]').forEach(el=>{el.checked=family.parameters.includes(el.value);});f.elements.name.focus();}
  if(b.dataset.deleteFamily){if(data.articles.some(a=>a.family===b.dataset.deleteFamily))throw Error('La familia tiene artículos. Reclasifícalos antes de eliminarla.');next.families=next.families.filter(f=>f.id!==b.dataset.deleteFamily);saveCatalog(next);}
  if(b.dataset.editArticle){const a=data.articles.find(a=>a.id===b.dataset.editArticle),f=document.querySelector('#article-form');for(const k of ['id','name','family','formula'])f.elements[k].value=a[k];f.elements.name.focus();}
  if(b.dataset.deleteArticle){if(data.lines.some(l=>l.article===b.dataset.deleteArticle)||data.tariffs.some(t=>t.prices.some(p=>p.article===b.dataset.deleteArticle)))throw Error('El artículo tiene líneas o precios de tarifa. Retíralos antes de eliminarlo.');next.articles=next.articles.filter(a=>a.id!==b.dataset.deleteArticle);saveCatalog(next);}
 }catch(error){notice(error.message);}
});
document.addEventListener('change',e=>{
 const el=e.target,next=structuredClone(data);
 try{
  if(el.dataset.param){const line=next.lines[Number(el.dataset.line)],article=next.articles.find(a=>a.id===line.article),p=familyParameters(article,next).find(p=>p.id===el.dataset.param);if(!p)throw Error('Parámetro ajeno a la familia');if(p.type==='number'&&(el.value===''||!Number.isFinite(Number(el.value))))throw Error('Introduce un número válido');line.values[p.id]=p.type==='number'?Number(el.value):el.value;validate(next);commit(next);render();}
  if(el.dataset.quantity!==undefined){const n=Number(el.value);if(!Number.isFinite(n)||n<=0)throw Error('La cantidad debe ser mayor que cero');next.lines[Number(el.dataset.quantity)].quantity=n;commit(next);render();}
  if(el.id==='selected-tariff'){next.selectedTariff=el.value;commit(next);render();}
  if(el.id==='customer'){next.customer=el.value;commit(next);}
 }catch(error){notice(error.message);}
});
document.addEventListener('submit',e=>{
 const f=e.target;if(!['parameter-form','family-form','article-form','line-form'].includes(f.id))return;e.preventDefault();
 const fd=new FormData(f),v=Object.fromEntries(fd),next=structuredClone(data);
 const upsert=(list,item)=>{const i=list.findIndex(x=>x.id===item.id);if(i<0)list.push(item);else list[i]=item;};
 try{
  if(f.id==='parameter-form'){
   const id=v.id.trim(),options=v.options.split(',').map(x=>x.trim()).filter(Boolean);if(next.parameters.some(p=>p.id===id)&&!f.elements.id.readOnly)throw Error('El identificador ya existe; utiliza Editar');
   if(v.type==='number'&&(v.value.trim()===''||!Number.isFinite(Number(v.value))))throw Error('Valor inicial numérico obligatorio');
   if(v.type==='select'&&!options.includes(v.value))throw Error('El valor inicial debe estar en las opciones');
   upsert(next.parameters,{id,name:v.name.trim(),type:v.type,options,value:v.type==='number'?Number(v.value):v.value});
  }
  if(f.id==='family-form'){const id=v.id.trim();if(next.families.some(x=>x.id===id)&&!f.elements.id.readOnly)throw Error('El código ya existe; utiliza Editar');upsert(next.families,{id,name:v.name.trim(),parameters:fd.getAll('parameters')});}
  if(f.id==='article-form')upsert(next.articles,{id:v.id||crypto.randomUUID(),name:v.name.trim(),family:v.family,formula:v.formula.trim()});
  if(f.id==='line-form'){const article=next.articles.find(a=>a.id===v.article);if(!article)throw Error('Selecciona un artículo');next.lines.push({article:article.id,quantity:1,values:defaultValues(article,next)});}
  saveCatalog(next);
 }catch(error){notice(error.message);}
});
document.querySelector('#export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='presupuesto-parametrico.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
document.querySelector('#import').onclick=()=>document.querySelector('#file').click();
document.querySelector('#file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2_000_000)throw Error('Máximo 2 MB');const next=validate(JSON.parse(await file.text()));if(!confirm('La importación sustituirá la configuración y el presupuesto actuales. ¿Continuar?'))return;commit(next);render();}catch(error){notice(error.message);}finally{e.target.value='';}};
render();

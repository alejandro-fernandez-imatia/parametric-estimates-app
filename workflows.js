import { schemas, prepareImport } from './importer.js';
import { calculate, validate, formulaValues } from './model.js';

export function setupWorkflows(context) {
  const {getData, commit, esc, notice, render} = context;
  let preview = null;
  const input = (label,name,value='',type='text')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" required ${type==='number'?'step="any"':''}></label>`;
  function tariffsView() {
    const data=getData();
    return `<div class="card"><h2>Tarifas comerciales</h2><p>Precio final = precio del artículo en tarifa (o su fórmula base) × coeficiente × (1 − descuento / 100). Sin impuestos.</p>${data.tariffs.map(t=>`<div class="row"><div><strong>${esc(t.name)}</strong><p><code>${esc(t.id)}</code> · Coeficiente ${t.multiplier} · Descuento ${t.discount}% · ${t.prices.length} precios específicos</p></div><div><button data-edit-tariff="${esc(t.id)}">Editar</button> <button class="danger" data-delete-tariff="${esc(t.id)}">Eliminar</button></div></div>`).join('')||'<p>Todavía no hay tarifas. Crea una o importa el Excel de ejemplo.</p>'}</div>
    <form class="card" id="tariff-form"><h2>Crear o actualizar tarifa</h2><div class="fields">${input('Código único','id')}${input('Nombre','name')}${input('Coeficiente (1 = sin cambio)','multiplier',1,'number')}${input('Descuento (%)','discount',0,'number')}</div><button class="primary">Guardar tarifa</button></form>
    <div class="card"><h2>Precios específicos por artículo</h2><p>Si no hay precio específico se utiliza la fórmula base del artículo. Las fórmulas se guardan como texto, por ejemplo <code>ancho * alto * 42</code>.</p><form id="tariff-price-form"><div class="fields"><label>Tarifa<select name="tariff">${data.tariffs.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label><label>Artículo<select name="article">${data.articles.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select></label>${input('Precio fijo o fórmula','formula')}</div><button class="primary" ${!data.tariffs.length||!data.articles.length?'disabled':''}>Guardar precio</button></form>
    ${data.tariffs.flatMap(t=>t.prices.map(p=>`<div class="row"><div><strong>${esc(t.name)} / ${esc(data.articles.find(a=>a.id===p.article)?.name)}</strong><p><code>${esc(p.formula)}</code></p></div><div><button data-edit-price="${esc(t.id)}" data-article="${esc(p.article)}">Editar</button> <button class="danger" data-delete-price="${esc(t.id)}" data-article="${esc(p.article)}">Quitar precio</button></div></div>`)).join('')}</div>`;
  }
  function importView() {
    return `<div class="card"><h2>Archivos de ejemplo</h2><p>Catálogo de carpintería con 10 parámetros, 7 familias, 12 artículos, 3 tarifas y 12 precios específicos. Datos de prueba editables.</p><div class="actions"><a href="/examples/00_configuracion_completa.xlsx" download>Configuración completa</a><a href="/examples/01_parametros.xlsx" download>Parámetros y familias</a><a href="/examples/02_articulos.xlsx" download>Artículos</a><a href="/examples/03_tarifas.xlsx" download>Tarifas y precios</a></div><p>Primera carga: usa la configuración completa, o importa parámetros → artículos → tarifas. Las hojas Instrucciones y Pruebas no se importan.</p></div>
    <div class="card"><h2>Importar Excel (.xlsx)</h2><p>Se añaden registros nuevos y se actualizan los códigos existentes. Se mantienen los demás registros y las líneas del presupuesto. Antes de importar, puedes exportar JSON como copia de seguridad.</p><label>Seleccionar archivo<input id="excel-file" type="file" accept=".xlsx"></label><div id="excel-result" aria-live="polite"></div></div>
    <div class="card"><h2>Formato de las hojas</h2>${Object.entries(schemas).map(([name,fields])=>`<p><strong>${name}</strong>: <code>${fields.join(' | ')}</code></p>`).join('')}<p>Cabeceras en fila 1. En Familias, parametros contiene los identificadores separados por |. En Articulos, familia contiene el código de su familia. Opciones separadas por <code>|</code>. Tipos: numero, texto, lista. Descuento: 10 significa 10%. Las fórmulas de precio son texto sin signo =; no uses fórmulas de Excel. Máximo 2 MB y 5000 filas por hoja.</p></div>`;
  }
  document.addEventListener('change',async e=>{
    if(e.target.id!=='excel-file')return;
    const file=e.target.files[0];preview=null;if(!file)return;
    const output=document.querySelector('#excel-result'); output.textContent='Leyendo y validando el archivo…';
    try {
      if(!file.name.toLowerCase().endsWith('.xlsx'))throw Error('Selecciona un archivo .xlsx');
      if(file.size>2_000_000)throw Error('Máximo 2 MB');
      const response=await fetch('/api/excel',{method:'POST',body:file,headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});
      if(!response.ok)throw Error(await response.text());
      const sheets=await response.json();
      if(!output.isConnected)return;
      const result=prepareImport(getData(),sheets);
      preview=result.errors.length?null:sheets;
      output.innerHTML=`<h2>Vista previa · ${esc(file.name)}</h2><table><thead><tr><th>Hoja</th><th>Nuevos</th><th>Actualizaciones</th></tr></thead><tbody>${result.summary.map(s=>`<tr><td>${esc(s.name)}</td><td>${s.added}</td><td>${s.updated}</td></tr>`).join('')}</tbody></table>${result.errors.length?`<p class="error">No se ha importado ningún registro. Corrige los errores:</p><ul class="error">${result.errors.slice(0,30).map(error=>`<li>${esc(error)}</li>`).join('')}</ul>${result.errors.length>30?'<p>Se muestran los primeros 30 errores.</p>':''}`:'<p>Archivo validado. Las líneas conservan sus valores compatibles. Los parámetros nuevos toman su valor inicial; los que dejan de pertenecer a la familia se retiran.</p><button class="primary" id="apply-excel">Confirmar importación</button>'}`;
    }catch(error){if(output.isConnected)output.textContent=error.message;}
  });
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    const data=structuredClone(getData());
    if(b.id==='apply-excel'&&preview){const result=prepareImport(data,preview);if(result.errors.length){notice(result.errors.join('; '));return;}commit(result.data);preview=null;render();notice('Importación completada. Ya puedes configurar el presupuesto.');}
    if(b.dataset.editTariff){const t=data.tariffs.find(t=>t.id===b.dataset.editTariff),f=document.querySelector('#tariff-form');for(const k of ['id','name','multiplier','discount'])f.elements[k].value=t[k];f.elements.id.focus();}
    if(b.dataset.deleteTariff){data.tariffs=data.tariffs.filter(t=>t.id!==b.dataset.deleteTariff);if(data.selectedTariff===b.dataset.deleteTariff)data.selectedTariff='';commit(data);render();}
    if(b.dataset.editPrice){const t=data.tariffs.find(t=>t.id===b.dataset.editPrice),p=t.prices.find(p=>p.article===b.dataset.article),f=document.querySelector('#tariff-price-form');f.elements.tariff.value=t.id;f.elements.article.value=p.article;f.elements.formula.value=p.formula;f.elements.formula.focus();}
    if(b.dataset.deletePrice){data.tariffs.find(t=>t.id===b.dataset.deletePrice).prices=data.tariffs.find(t=>t.id===b.dataset.deletePrice).prices.filter(p=>p.article!==b.dataset.article);commit(data);render();}
  });
  document.addEventListener('submit',e=>{
    if(!['tariff-form','tariff-price-form'].includes(e.target.id))return;
    e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),data=structuredClone(getData());
    try{
      if(e.target.id==='tariff-form'){
        const existing=data.tariffs.find(t=>t.id===v.id.trim());
        const t={id:v.id.trim(),name:v.name.trim(),multiplier:Number(v.multiplier),discount:Number(v.discount),prices:existing?.prices||[]};
        if(existing)data.tariffs[data.tariffs.indexOf(existing)]=t;else data.tariffs.push(t);
      }else{
        const article=data.articles.find(a=>a.id===v.article);if(!article)throw Error('Selecciona un artículo');const values=formulaValues(article,data);
        if(calculate(v.formula,values)<0)throw Error('Precio negativo');
        const t=data.tariffs.find(t=>t.id===v.tariff);if(!t)throw Error('Selecciona una tarifa');
        const p={article:v.article,formula:v.formula.trim()},i=t.prices.findIndex(p=>p.article===v.article);
        if(i<0)t.prices.push(p);else t.prices[i]=p;
      }
      validate(data);commit(data);render();
    }catch(error){notice(error.message);}
  });
  return {tariffsView,importView};
}

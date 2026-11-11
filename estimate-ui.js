import {setEstimateStatus,statuses,today,rememberEstimate,newEstimate,openEstimate,duplicateEstimate,duplicateLine,estimateTotals,validateWorkspace,searchArticles,lineParameters} from './estimates.js';
import {calculate,numericOptionValue,applyOptionPricing} from './model.js';

export function setupEstimateUi({getData,commit,render,notice,esc,money,setView}){
 let query='',status='',catalogQuery='',catalogFamily='',quoteQuery='',quoteFamily='';
 const field=(label,key,value,type='text',area=false)=>`<label>${label}${area?`<textarea ${key} rows="3">${esc(value)}</textarea>`:`<input ${key} type="${type}" value="${esc(value)}" ${type==='number'?'step="any" min="0"':''}>`}</label>`;
 function cancellationAction(q){return q.estimate.status==='Anulado'?`<button data-reactivate-estimate="${esc(q.estimate.id)}">Reactivar como borrador</button>`:`<button class="danger" data-cancel-estimate="${esc(q.estimate.id)}">Anular presupuesto</button>`;}
 function actions(){return `<div class="estimate-actions"><button class="primary" data-save-estimate>Guardar</button><button data-new-estimate>Nuevo</button><button data-duplicate-estimate="${esc(getData().estimate.id)}">Duplicar presupuesto</button>${cancellationAction(getData())}</div>`;}
 function tariffSelector(){const d=getData(),tariffs=new Map(d.tariffs.map(t=>[t.id,t]));for(const line of d.lines)for(const t of line.snapshot?.tariffs||[])if(!tariffs.has(t.id))tariffs.set(t.id,t);return `<label>Tarifa del presupuesto<select id="selected-tariff"><option value="">Sin tarifa</option>${[...tariffs.values()].map(t=>`<option value="${esc(t.id)}" ${d.selectedTariff===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>`;}
 function metadataView(){const d=getData();return `<div class="card quote-data"><h2>Datos del presupuesto</h2>${d.estimate.status==='Anulado'?'<p class="cancelled-notice" role="status"><strong>Presupuesto anulado.</strong> Se conserva para consulta. Puedes reactivarlo como borrador o duplicarlo para preparar una alternativa.</p>':''}<div class="estimate-metadata">${field('Número','data-estimate-field="number"',d.estimate.number)}${field('Fecha','data-estimate-field="date"',d.estimate.date,'date')}<label>Estado<select data-estimate-field="status">${statuses.map(s=>`<option ${s===d.estimate.status?'selected':''}>${s}</option>`).join('')}</select></label>${field('Cliente o referencia','id="customer"',d.customer)}${tariffSelector()}</div><details class="commercial-details"><summary>Datos del cliente y de la empresa emisora</summary><div class="fields">${field('Datos del cliente (dirección, NIF…)','data-commercial-field="customerDetails"',d.commercial.customerDetails,'text',true)}${field('Empresa emisora','data-issuer-field="name"',d.issuer.name)}${field('NIF del emisor','data-issuer-field="taxId"',d.issuer.taxId)}${field('Dirección del emisor','data-issuer-field="address"',d.issuer.address,'text',true)}${field('Correo electrónico','data-issuer-field="email"',d.issuer.email,'email')}${field('Teléfono','data-issuer-field="phone"',d.issuer.phone)}</div></details>${d.selectedTariff?`<p class="muted">Regla de precio conservada: ${esc(d.tariffs.find(t=>t.id===d.selectedTariff)?.name||d.lines.flatMap(l=>l.snapshot?.tariffs||[]).find(t=>t.id===d.selectedTariff)?.name||d.selectedTariff)}</p>`:''}${actions()}<p class="muted">Guardado automático en este navegador. La tarifa se aplica a todas las líneas con precio calculado. Los precios manuales se conservan hasta pulsar «Volver al calculado». El PDF necesita cliente, empresa emisora y al menos una línea.</p></div>`;}
 function economicView(){const d=getData();let t,error;try{t=estimateTotals(d);}catch(e){error=e.message;}
 return `<div class="card"><h2>Condiciones económicas y comerciales</h2><div class="economic-layout"><div><div class="fields">${field('Portes (€)','data-commercial-field="shipping"',d.commercial.shipping,'number')}${field('Impuesto (%) sobre neto y portes','data-commercial-field="tax"',d.commercial.tax,'number')}${field('Válido hasta','data-commercial-field="validUntil"',d.commercial.validUntil,'date')}</div>${field('Condiciones comerciales','data-commercial-field="terms"',d.commercial.terms,'text',true)}</div><div class="economic-totals">${t?`<div><span>Importe bruto</span><strong>${money(t.gross)}</strong></div><div><span>Descuentos de líneas</span><strong>− ${money(t.discount)}</strong></div><div><span>Portes</span><strong>${money(t.shipping)}</strong></div><div><span>Base</span><strong>${money(t.base)}</strong></div><div><span>Impuesto (${t.tax}%)</span><strong>${money(t.taxAmount)}</strong></div><div class="grand-total"><span>Total</span><strong>${money(t.total)}</strong></div>`:`<p class="error">${esc(error)}</p>`}</div></div></div>`;}
 function quoteListRows(){const data=getData();return [...data.savedEstimates].reverse().filter(q=>(!status||q.estimate.status===status)&&`${q.estimate.number} ${q.customer}`.toLowerCase().includes(query.toLowerCase())).map(q=>{let total;try{total=money(estimateTotals({...data,...q}).total);}catch{total='Pendiente';}return `<div class="saved-estimate"><div><strong>${esc(q.estimate.number)}</strong><p>${esc(q.customer||'Sin cliente')} · ${esc(q.estimate.date)}</p><span class="status-badge ${q.estimate.status==='Anulado'?'status-cancelled':''}">${esc(q.estimate.status)}</span></div><strong>${total}</strong><div class="actions"><button data-open-estimate="${esc(q.estimate.id)}">Abrir</button><button data-duplicate-estimate="${esc(q.estimate.id)}">Duplicar</button>${cancellationAction(q)}</div></div>`;}).join('')||'<p>No hay presupuestos que coincidan.</p>';}
 function listView(){return `<div class="card"><div class="row"><h2>Presupuestos guardados</h2><button class="primary" data-new-estimate>+ Nuevo presupuesto</button></div><div class="fields"><label>Buscar por número o cliente<input id="estimate-search" value="${esc(query)}"></label><label>Estado<select id="estimate-status"><option value="">Todos los estados</option>${statuses.map(s=>`<option ${status===s?'selected':''}>${s}</option>`).join('')}</select></label></div><div id="estimate-list">${quoteListRows()}</div></div>`;}
 function searchBar(prefix){const quote=prefix==='quote',q=quote?quoteQuery:catalogQuery,f=quote?quoteFamily:catalogFamily;return `<div class="catalog-filters"><label>Buscar artículo<input id="${prefix}-article-search" placeholder="Código, descripción o familia" value="${esc(q)}"></label><label>Familia<select id="${prefix}-family-filter"><option value="">Todas las familias</option>${getData().families.map(x=>`<option value="${esc(x.id)}" ${f===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label></div>`;}
 function filtered(prefix){return searchArticles(getData(),prefix==='quote'?quoteQuery:catalogQuery,prefix==='quote'?quoteFamily:catalogFamily);}
 function articleOptions(){return filtered('quote').map(a=>`<option value="${esc(a.id)}">${esc(a.id)} · ${esc(a.name)}</option>`).join('');}
 function catalogCards(){return filtered('catalog').map(a=>`<div class="row"><div><strong>${esc(a.name)}</strong><p>${esc(a.id)} · ${esc(getData().families.find(f=>f.id===a.family)?.name)} · <code>${esc(a.formula)}</code></p></div><div><button data-edit-article="${esc(a.id)}">Editar</button> <button class="danger" data-delete-article="${esc(a.id)}">Eliminar</button></div></div>`).join('')||'<p>No hay artículos que coincidan.</p>';}
 function refreshSearch(prefix){if(prefix==='catalog'){document.querySelector('#catalog-results').innerHTML=catalogCards();return;}const select=document.querySelector('#line-form select[name="article"]'),previous=select.value;select.innerHTML=articleOptions();if(filtered('quote').some(a=>a.id===previous))select.value=previous;document.querySelector('#line-form button').disabled=!select.options.length;}
 function formulaAssistant(){return `<details class="formula-assistant" open><summary>Asistente de fórmulas</summary><p class="muted">Elige una familia para insertar sus parámetros. Prueba el cálculo antes de guardar.</p><div id="formula-parameters" class="formula-chips"></div><div class="formula-operators">${['+','-','*','/','(',')'].map(op=>`<button type="button" data-insert-formula="${op}" aria-label="Insertar ${op}">${op}</button>`).join('')}</div><h3>Valores de prueba</h3><div id="formula-test-values" class="fields"></div><p id="formula-result" role="status"></p></details>`;}
 function updateFormulaAssistant(){const f=document.querySelector('#article-form');if(!f)return;const family=getData().families.find(x=>x.id===f.elements.family.value),parameters=(family?.parameters||[]).map(id=>getData().parameters.find(p=>p.id===id)).filter(p=>p&&p.type!=='text');
 document.querySelector('#formula-parameters').innerHTML=parameters.filter(p=>!p.optionPricing||p.optionPricing.mode==='value').map(p=>`<button type="button" data-insert-formula="${esc(p.id)}">${esc(p.name)} <small>${esc(p.id)}</small></button>`).join('')||'<p>Esta familia no tiene parámetros numéricos. Puedes indicar un precio fijo.</p>';
 document.querySelector('#formula-test-values').innerHTML=parameters.map(p=>`<label>${esc(p.name)}${p.type==='select'?`<select data-formula-test="${esc(p.id)}">${p.options.map(o=>`<option ${o===p.value?'selected':''}>${esc(o)}</option>`).join('')}</select>`:`<input type="number" step="any" data-formula-test="${esc(p.id)}" value="${esc(p.value)}">`}</label>`).join('');testFormula();
 }
 function testFormula(){const f=document.querySelector('#article-form'),output=document.querySelector('#formula-result');if(!f||!output)return;try{
 const family=getData().families.find(x=>x.id===f.elements.family.value),parameters=(family?.parameters||[]).map(id=>getData().parameters.find(p=>p.id===id)).filter(Boolean);
 const configured=Object.fromEntries([...document.querySelectorAll('[data-formula-test]')].map(el=>[el.dataset.formulaTest,el.value]));
 const values=Object.fromEntries(parameters.filter(p=>p.type!=='text'&&(!p.optionPricing||p.optionPricing.mode==='value')).map(p=>[p.id,numericOptionValue(p,configured[p.id])]));
 const base=calculate(f.elements.formula.value,values);if(base<0)throw Error('El precio no puede ser negativo');
 const value=applyOptionPricing(base,parameters,configured);output.className='formula-result';output.textContent=`Resultado de prueba: ${money(value)}`;
 }catch(error){output.className='error';output.textContent=error.message;}}

 document.addEventListener('input',e=>{const el=e.target;if(el.id==='estimate-search'){query=el.value;document.querySelector('#estimate-list').innerHTML=quoteListRows();}if(el.id==='catalog-article-search'){catalogQuery=el.value;refreshSearch('catalog');}if(el.id==='quote-article-search'){quoteQuery=el.value;refreshSearch('quote');}if(el.dataset.formulaTest||el.matches('#article-form [name="formula"]'))testFormula();});
 document.addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='estimate-status'){status=el.value;document.querySelector('#estimate-list').innerHTML=quoteListRows();}
  if(el.id==='catalog-family-filter'){catalogFamily=el.value;refreshSearch('catalog');}if(el.id==='quote-family-filter'){quoteFamily=el.value;refreshSearch('quote');}
  if(el.matches('#article-form [name="family"]'))updateFormulaAssistant();if(el.dataset.formulaTest)testFormula();
  if(!el.dataset.estimateField&&!el.dataset.commercialField&&!el.dataset.issuerField&&el.dataset.lineDiscount===undefined)return;
  const next=structuredClone(getData());try{
   if(el.dataset.estimateField)next.estimate[el.dataset.estimateField]=el.value.trim();
   if(el.dataset.commercialField){const k=el.dataset.commercialField;if(['shipping','tax'].includes(k)&&el.value==='')throw Error('Introduce un importe o porcentaje');next.commercial[k]=['shipping','tax'].includes(k)?Number(el.value):el.value;}
   if(el.dataset.issuerField)next.issuer[el.dataset.issuerField]=el.value;
   if(el.dataset.lineDiscount!==undefined){if(el.value==='')throw Error('Introduce un descuento');next.lines[Number(el.dataset.lineDiscount)].discount=Number(el.value);}
   validateWorkspace(next);commit(next);if(el.dataset.estimateField==='status'||el.dataset.lineDiscount!==undefined||['shipping','tax'].includes(el.dataset.commercialField))render();
  }catch(error){notice(error.message);}
 });
 document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  try{
   if(b.dataset.cancelEstimate||b.dataset.reactivateEstimate){const cancelled=Boolean(b.dataset.cancelEstimate);commit(setEstimateStatus(getData(),b.dataset.cancelEstimate||b.dataset.reactivateEstimate,cancelled?'Anulado':'Borrador'));render();notice(cancelled?'Presupuesto anulado. Puedes recuperarlo con Deshacer o reactivarlo como borrador.':'Presupuesto reactivado como borrador.');return;}
   if(b.hasAttribute('data-save-estimate')){const next=structuredClone(getData());rememberEstimate(next);commit(next);notice('Presupuesto guardado en este navegador.');}
   if(b.hasAttribute('data-new-estimate')){commit(newEstimate(getData()));setView('quote');render();}
   if(b.dataset.openEstimate){commit(openEstimate(getData(),b.dataset.openEstimate),{recordUndo:false,resetHistory:true});setView('quote');render();}
   if(b.dataset.duplicateEstimate){commit(duplicateEstimate(getData(),b.dataset.duplicateEstimate));setView('quote');render();}
   if(b.dataset.duplicateLine!==undefined){commit(duplicateLine(structuredClone(getData()),Number(b.dataset.duplicateLine)));render();}
   if(b.dataset.insertFormula!==undefined){const input=document.querySelector('#article-form [name="formula"]'),value=b.dataset.insertFormula,start=input.selectionStart??input.value.length,end=input.selectionEnd??start;input.value=input.value.slice(0,start)+value+input.value.slice(end);input.focus();input.setSelectionRange(start+value.length,start+value.length);testFormula();}
   if(b.hasAttribute('data-pdf')){
    const data=getData();if(!data.customer.trim()||!data.issuer.name.trim()||!data.lines.length)throw Error('Indica cliente y empresa emisora, y añade al menos una línea.');
    estimateTotals(data);
    const preview=document.defaultView.open('','_blank');
    if(!preview)throw Error('Permite las ventanas emergentes de esta aplicación para imprimir.');
    preview.opener=null;preview.document.title='Imprimir '+data.estimate.number;
    preview.document.body.textContent='Preparando presupuesto para imprimir…';
    b.disabled=true;b.textContent='Preparando…';let url;
    try{
     const response=await fetch('/api/pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,parameters:[],families:[],articles:[],tariffs:[],savedEstimates:[]})});
     if(!response.ok)throw Error(await response.text());
     if(preview.closed)return;
     url=URL.createObjectURL(await response.blob());
     const doc=preview.document,frame=doc.createElement('iframe'),print=doc.createElement('button'),help=doc.createElement('p');
     doc.body.replaceChildren();doc.body.style.cssText='margin:0;font:16px Arial;background:#fff;color:#2C2A29';
     print.textContent='Imprimir';print.style.cssText='margin:12px;padding:12px 24px;background:#FF5033;border:0;cursor:pointer;font-size:16px';
     help.textContent='Si no se abre el diálogo, pulsa Imprimir o utiliza el icono de impresión del visor PDF.';help.style.cssText='display:inline-block;margin:12px';
     frame.title='Presupuesto para imprimir';frame.style.cssText='display:block;width:100%;height:calc(100vh - 90px);border:0';
     const printDocument=()=>{try{frame.contentWindow.focus();frame.contentWindow.print();}catch{notice('Utiliza el icono de impresión del visor PDF.');}};
     print.addEventListener('click',printDocument);frame.addEventListener('load',printDocument,{once:true});
     frame.src=url;doc.body.append(print,help,frame);
     preview.addEventListener('beforeunload',()=>URL.revokeObjectURL(url),{once:true});
    }catch(error){if(url)URL.revokeObjectURL(url);preview.close();throw error;}
    finally{b.disabled=false;b.textContent='Imprimir';}
   }
  }catch(error){notice(error.message);}
 });
 return {metadataView,economicView,listView,searchBar,articleOptions,catalogCards,formulaAssistant,updateFormulaAssistant,filtered};
}

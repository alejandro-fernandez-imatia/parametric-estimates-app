import {commonParameters,applyBulkParameter} from './editing.js';

export function setupEditingUi({getData,commit,render,notice,esc,money}){
 let selected=new Set(),scope='',count=-1,parameterId='';
 function sync(){const data=getData();if(scope!==data.estimate.id||count!==data.lines.length){selected.clear();parameterId='';scope=data.estimate.id;count=data.lines.length;}}
 function clear(){selected.clear();parameterId='';scope='';count=-1;}
 function parameters(){return selected.size?commonParameters(getData(),[...selected]):[];}
 function toolbar(){sync();const available=parameters();if(!available.some(p=>p.id===parameterId))parameterId=available[0]?.id||'';
  return `<div class="bulk-toolbar"><div class="bulk-actions"><button type="button" data-select-all ${!getData().lines.length?'disabled':''}>Seleccionar todas</button><button type="button" data-clear-selection ${!selected.size?'disabled':''}>Quitar selección</button><strong>${selected.size} líneas seleccionadas</strong></div>${selected.size?available.length?`<form id="bulk-form"><label>Parámetro común<select id="bulk-parameter" name="parameter">${available.map(p=>`<option value="${esc(p.id)}" ${p.id===parameterId?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><div id="bulk-value-container">${bulkInput()}</div><button class="primary">Aplicar a ${selected.size} líneas</button></form><p class="muted">Se cambiará solo este parámetro. Puedes deshacer el cambio completo.</p>`:'<p>No hay parámetros compatibles en todas las líneas seleccionadas. Selecciona artículos con la misma configuración.</p>':''}</div>`;
 }
 function bulkInput(){const p=parameters().find(p=>p.id===parameterId);if(!p)return '';return `<label>Nuevo valor${p.type==='select'?`<select name="value">${p.options.map(o=>`<option value="${esc(o)}">${esc(optionCaption(p,o))}</option>`).join('')}</select>`:`<input name="value" type="${p.type}" ${p.type==='number'?'step="any"':''} required>`}</label>`;}
 function optionCaption(p,option){if(!p.optionPricing)return option;const amount=p.optionPricing.values.find(v=>v.option===option)?.amount;if(p.optionPricing.mode==='add')return `${option} (+${money(amount)}/ud.)`;if(p.optionPricing.mode==='multiply')return `${option} (×${amount})`;return `${option} (${amount})`;}
 function selectionInput(index){return `<label class="line-selection"><input type="checkbox" data-select-line="${index}" ${selected.has(index)?'checked':''} aria-label="Seleccionar línea ${index+1}"><span class="sr-only">Seleccionar línea ${index+1}</span></label>`;}
 function pricingEditor(){return `<fieldset class="option-pricing-editor" id="option-pricing-editor" hidden><legend>Precio asociado a las opciones</legend><label class="pricing-enabled"><input type="checkbox" name="pricingEnabled"> Activar valores o ajustes de precio</label><div id="option-pricing-settings" hidden><label>Cómo afecta al precio<select name="pricingMode"><option value="add">Suplemento por unidad (€)</option><option value="multiply">Coeficiente del precio</option><option value="value">Valor numérico para la fórmula</option></select></label><p class="muted">Los suplementos y coeficientes se aplican automáticamente: (fórmula + suplementos) × coeficientes. No incluyas esos parámetros en la fórmula. En modo «Valor numérico», utiliza el identificador del parámetro en la fórmula.</p><div id="option-pricing-values"></div></div></fieldset>`;}
 function updatePricingEditor(parameter){const form=document.querySelector('#parameter-form');if(!form)return;const editor=document.querySelector('#option-pricing-editor');editor.hidden=form.elements.type.value!=='select';
  if(parameter){form.elements.pricingEnabled.checked=!!parameter.optionPricing;form.elements.pricingMode.value=parameter.optionPricing?.mode||'add';}
  const settings=document.querySelector('#option-pricing-settings');settings.hidden=!form.elements.pricingEnabled.checked;
  const old=parameter?.optionPricing?Object.fromEntries(parameter.optionPricing.values.map(v=>[v.option,v.amount])):Object.fromEntries([...document.querySelectorAll('[data-price-option]')].map(el=>[el.dataset.priceOption,el.value]));
  const options=form.elements.options.value.split(',').map(o=>o.trim()).filter(Boolean),fallback=form.elements.pricingMode.value==='multiply'?1:0;
  document.querySelector('#option-pricing-values').innerHTML=options.map(option=>`<label>${esc(option)}<input type="number" min="0" step="any" data-price-option="${esc(option)}" value="${esc(Object.hasOwn(old,option)?old[option]:fallback)}"></label>`).join('')||'<p>Introduce primero las opciones de la lista.</p>';
 }
 function readPricing(form,options,type){if(type!=='select'||!form.elements.pricingEnabled.checked)return undefined;const values=options.map(option=>{const input=[...form.querySelectorAll('[data-price-option]')].find(el=>el.dataset.priceOption===option);if(!input||input.value===''||!Number.isFinite(Number(input.value))||Number(input.value)<0)throw Error(`Introduce un valor de precio válido para ${option}`);return {option,amount:Number(input.value)};});return {mode:form.elements.pricingMode.value,values};}
 document.addEventListener('change',e=>{const el=e.target;
  if(el.dataset.selectLine!==undefined){const index=Number(el.dataset.selectLine);if(el.checked)selected.add(index);else selected.delete(index);render();}
  if(el.id==='bulk-parameter'){parameterId=el.value;document.querySelector('#bulk-value-container').innerHTML=bulkInput();}
  if(el.closest('#parameter-form')&&['type','options','pricingEnabled','pricingMode'].includes(el.name))updatePricingEditor();
 });
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-select-all')){selected=new Set(getData().lines.map((_,i)=>i));render();}
  if(b.hasAttribute('data-clear-selection')){selected.clear();render();}
 });
 document.addEventListener('submit',e=>{if(e.target.id!=='bulk-form')return;e.preventDefault();try{const values=Object.fromEntries(new FormData(e.target));commit(applyBulkParameter(getData(),[...selected],values.parameter,values.value));render();notice(`Parámetro actualizado en ${selected.size} líneas.`);}catch(error){notice(error.message);}});
 return {sync,clear,toolbar,selectionInput,pricingEditor,updatePricingEditor,readPricing,optionCaption};
}

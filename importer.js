import { calculate, validate, formulaValues, reconcileLines } from './model.js';

export const schemas = {
  Parametros: ['codigo', 'nombre', 'tipo', 'valor', 'opciones'],
  Familias: ['codigo', 'nombre', 'parametros'],
  Articulos: ['codigo', 'nombre', 'familia', 'formula'],
  Tarifas: ['codigo', 'nombre', 'coeficiente', 'descuento'],
  Precios: ['tarifa', 'articulo', 'formula']
};
const str = value => String(value ?? '').trim();
function number(value, name) {
  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value;
  if (normalized === '' || normalized === null || normalized === undefined || typeof normalized === 'boolean' || !Number.isFinite(Number(normalized))) throw Error(`${name}: se esperaba un número`);
  return Number(normalized);
}
function merge(items, incoming, key) {
  for (const item of incoming) { const index = items.findIndex(existing => existing[key] === item[key]); if (index < 0) items.push(item); else items[index] = item; }
}
export function prepareImport(current, sheets) {
  const data = validate(structuredClone(current));
  const errors = [], summary = [];
  const incoming = {};
  for (const [name, headers] of Object.entries(schemas)) {
    if (!Object.hasOwn(sheets, name)) continue;
    const rows = sheets[name];
    if (!Array.isArray(rows) || !rows.length || headers.filter(h=>h!=='familia').some(h => !Object.hasOwn(rows[0], h))) { errors.push(`${name}: faltan columnas (${headers.join(', ')}) o no hay datos`); continue; }
    const seen = new Set(); incoming[name] = [];
    rows.forEach((row, index) => {
      try {
        const code = name === 'Precios' ? `${str(row.tarifa)}\u0000${str(row.articulo)}` : str(row.codigo);
        if (seen.has(code)) throw Error('Código duplicado en el archivo'); seen.add(code);
        if (!str(name === 'Precios' ? row.tarifa : row.codigo)) throw Error('Código obligatorio');
        let item;
        if (name === 'Parametros') {
          const type = {numero:'number',texto:'text',lista:'select',number:'number',text:'text',select:'select'}[str(row.tipo).toLowerCase()];
          if (!type) throw Error('Tipo esperado: numero, texto o lista');
          const options = str(row.opciones).split('|').map(str).filter(Boolean);
          item = {id:str(row.codigo),name:str(row.nombre),type,options,value:type==='number'?number(row.valor,'valor'):str(row.valor)};
          if(Object.hasOwn(row,'modo_precio')){
            const modeName=str(row.modo_precio).toLowerCase();
            if(!modeName&&str(row.valores_precio))throw Error('Indica el modo de precio para los valores de las opciones');
            if(modeName){
              const mode={add:'add',suplemento:'add',multiply:'multiply',coeficiente:'multiply',value:'value',valor:'value'}[modeName];
              if(!mode||type!=='select')throw Error('Modo de precio válido solo en listas: suplemento, coeficiente o valor');
              const amounts=str(row.valores_precio).split('|');
              if(amounts.length!==options.length)throw Error('Debe haber un valor de precio por opción, en el mismo orden');
              item.optionPricing={mode,values:options.map((option,i)=>({option,amount:number(amounts[i],'precio de opción')}))};
            }
          }else{
            const pricing=data.parameters.find(p=>p.id===item.id)?.optionPricing;
            if(pricing&&type==='select')item.optionPricing=structuredClone(pricing);
          }
          if (!/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(item.id)) throw Error('Identificador inválido para fórmula');
          if (type === 'select' && !options.includes(item.value)) throw Error('El valor inicial no está en las opciones');
        } else if (name === 'Familias') {
          item = {id:str(row.codigo),name:str(row.nombre),parameters:str(row.parametros).split('|').map(str).filter(Boolean)};
        } else if (name === 'Articulos') {
          item = {id:str(row.codigo),name:str(row.nombre),family:Object.hasOwn(row,'familia')?str(row.familia):(data.articles.find(a=>a.id===str(row.codigo))?.family||'GENERAL'),formula:str(row.formula)};
          if (!item.family) throw Error('Familia obligatoria');
          if (!item.formula) throw Error('Fórmula obligatoria');
        } else if (name === 'Tarifas') {
          const id = str(row.codigo);
          item = {id,name:str(row.nombre),multiplier:number(row.coeficiente,'coeficiente'),discount:number(row.descuento,'descuento'),prices:data.tariffs.find(t=>t.id===id)?.prices || []};
          if (item.multiplier < 0 || item.discount < 0 || item.discount > 100) throw Error('Coeficiente >= 0 y descuento entre 0 y 100');
        } else {
          item = {tariff:str(row.tarifa),article:str(row.articulo),formula:str(row.formula)};
          if (!item.article || !item.formula) throw Error('Artículo y fórmula obligatorios');
        }
        if (name !== 'Precios' && !item.name) throw Error('Nombre obligatorio');
        incoming[name].push(item);
      } catch (e) { errors.push(`${name}, fila ${index+2}: ${e.message}`); }
    });
    const existing = name === 'Parametros' ? data.parameters : name === 'Familias' ? data.families : name === 'Articulos' ? data.articles : name === 'Tarifas' ? data.tariffs : data.tariffs.flatMap(t=>t.prices.map(p=>({id:`${t.id}\u0000${p.article}`})));
    const updates = incoming[name].filter(x=>existing.some(y=>y.id === (name === 'Precios' ? `${x.tariff}\u0000${x.article}` : x.id))).length;
    summary.push({name,added:incoming[name].length-updates,updated:updates});
  }
  if (!summary.length && !errors.length) errors.push('No hay hojas importables. Usa Parametros, Articulos, Tarifas o Precios.');
  merge(data.parameters,incoming.Parametros || [],'id');
  merge(data.families,incoming.Familias || [],'id');
  if (!sheets.Familias && sheets.Articulos?.some(row=>!Object.hasOwn(row,'familia'))) {
    merge(data.families,[{id:'GENERAL',name:'General',parameters:data.parameters.map(p=>p.id)}],'id');
  }
  merge(data.articles,incoming.Articulos || [],'id');
  merge(data.tariffs,incoming.Tarifas || [],'id');
  for (const p of incoming.Precios || []) {
    const tariff = data.tariffs.find(t=>t.id === p.tariff);
    if (!tariff) errors.push(`Precios: tarifa desconocida ${p.tariff}`);
    else if (!data.articles.some(a=>a.id === p.article)) errors.push(`Precios: artículo desconocido ${p.article}`);
    else merge(tariff.prices,[{article:p.article,formula:p.formula}],'article');
  }
  const formulas = [...data.articles.map(a=>({article:a.id,label:`Artículo ${a.id}`,formula:a.formula})),...data.tariffs.flatMap(t=>t.prices.map(p=>({article:p.article,label:`Tarifa ${t.id} / ${p.article}`,formula:p.formula})))];
  for (const f of formulas) try {
    const article=data.articles.find(a=>a.id===f.article);
    if (calculate(f.formula,formulaValues(article,data)) < 0) throw Error('Precio negativo');
  } catch (e) {errors.push(`${f.label}: ${e.message}`);}
  try {reconcileLines(data);validate(data);} catch(e) {errors.push(e.message);}
  return {data,summary,errors};
}

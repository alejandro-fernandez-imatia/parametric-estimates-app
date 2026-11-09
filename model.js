export function calculate(expression, values) {
  const tokens = expression.match(/(?:\d+(?:\.\d*)?|\.\d+)|[a-zA-Z_][a-zA-Z_0-9]*|[()+*/-]/g) || [];
  if (tokens.join('') !== expression.replace(/\s/g, '')) throw Error('La fórmula contiene caracteres no permitidos');
  let i = 0;
  function atom() {
    const token = tokens[i++];
    if (token === '+' || token === '-') return (token === '-' ? -1 : 1) * atom();
    if (token === '(') { const value = sum(); if (tokens[i++] !== ')') throw Error('Falta cerrar un paréntesis'); return value; }
    if (token && /^\d|^\./.test(token)) return Number(token);
    if (token && Object.hasOwn(values, token) && values[token] !== '' && Number.isFinite(Number(values[token]))) return Number(values[token]);
    throw Error(`Parámetro numérico desconocido: ${token || '(vacío)'}`);
  }
  function product() { let n = atom(); while (tokens[i] === '*' || tokens[i] === '/') { const op = tokens[i++], b = atom(); if (op === '/' && b === 0) throw Error('División por cero'); n = op === '*' ? n * b : n / b; } return n; }
  function sum() { let n = product(); while (tokens[i] === '+' || tokens[i] === '-') { const op = tokens[i++], b = product(); n = op === '+' ? n + b : n - b; } return n; }
  const result = sum();
  if (i !== tokens.length || !Number.isFinite(result)) throw Error('Fórmula no válida');
  return result;
}
export function validate(data) {
  if (!data || !Array.isArray(data.parameters) || !Array.isArray(data.articles) || !Array.isArray(data.lines) || typeof data.customer !== 'string') throw Error('Formato de archivo no válido');
  const unique = items => new Set(items.map(x => x.id)).size === items.length;
  for (const p of data.parameters) {
    if (!p || typeof p.id !== 'string' || !/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(p.id) || typeof p.name !== 'string' || !['number','text','select'].includes(p.type) || !Array.isArray(p.options) || !p.options.every(x => typeof x === 'string') || !['string','number'].includes(typeof p.value) || (p.type === 'number' && (p.value === '' || !Number.isFinite(Number(p.value)))) || (p.type === 'select' && !p.options.includes(p.value))) throw Error('Parámetro no válido');
  }
  for (const a of data.articles) if (!a || typeof a.id !== 'string' || typeof a.name !== 'string' || typeof a.formula !== 'string' || !a.formula.trim()) throw Error('Artículo no válido');
  if (!unique(data.parameters) || !unique(data.articles)) throw Error('Hay identificadores duplicados');
  const legacy = data.families === undefined;
  if (legacy) {
    data.families = [{id:'GENERAL',name:'General',parameters:data.parameters.map(p=>p.id)}];
    data.articles.forEach(a=>{a.family='GENERAL';});
  }
  if (!Array.isArray(data.families)) throw Error('Familias no válidas');
  for (const f of data.families) {
    if (!f || typeof f.id !== 'string' || !f.id.trim() || typeof f.name !== 'string' || !f.name.trim() || !Array.isArray(f.parameters) || new Set(f.parameters).size !== f.parameters.length || f.parameters.some(id=>!data.parameters.some(p=>p.id===id))) throw Error('Familia no válida o parámetro desconocido');
  }
  if (!unique(data.families)) throw Error('Familias duplicadas');
  for (const a of data.articles) if (!data.families.some(f=>f.id===a.family)) throw Error(`Familia desconocida en artículo ${a.id}`);
  for (const l of data.lines) {
    if (!l || !data.articles.some(a => a.id === l.article) || typeof l.quantity !== 'number' || !Number.isFinite(l.quantity) || l.quantity <= 0) throw Error('Línea de presupuesto no válida');
    const article = data.articles.find(a=>a.id===l.article);
    if (legacy) l.values = defaultValues(article,data);
    if (!l.values || typeof l.values !== 'object' || Array.isArray(l.values)) throw Error('Faltan valores de configuración en la línea');
    for (const p of familyParameters(article,data)) {
      const value=l.values[p.id];
      if (!['number','string'].includes(typeof value) || (p.type==='number' && (value==='' || !Number.isFinite(Number(value)))) || (p.type==='select' && !p.options.includes(value))) throw Error(`Valor no válido en línea ${l.article}: ${p.id}`);
    }
    if (Object.keys(l.values).some(id=>!familyParameters(article,data).some(p=>p.id===id))) throw Error('La línea contiene parámetros ajenos a su familia');
  }
  if (data.tariffs === undefined) data.tariffs = [];
  if (data.selectedTariff === undefined) data.selectedTariff = '';
  if (!Array.isArray(data.tariffs)) throw Error('Tarifas no válidas');
  for (const t of data.tariffs) {
    if (!t || typeof t.id !== 'string' || !t.id.trim() || typeof t.name !== 'string' || !t.name.trim() || !Number.isFinite(t.multiplier) || t.multiplier < 0 || !Number.isFinite(t.discount) || t.discount < 0 || t.discount > 100 || !Array.isArray(t.prices)) throw Error('Tarifa no válida');
    for (const p of t.prices) if (!p || !data.articles.some(a => a.id === p.article) || typeof p.formula !== 'string' || !p.formula.trim()) throw Error('Precio de tarifa no válido');
    if (new Set(t.prices.map(p => p.article)).size !== t.prices.length) throw Error('Precios duplicados en tarifa');
  }
  if (!unique(data.tariffs)) throw Error('Tarifas duplicadas');
  if (typeof data.selectedTariff !== 'string' || (data.selectedTariff && !data.tariffs.some(t => t.id === data.selectedTariff))) throw Error('Tarifa seleccionada no válida');
  return data;
}

export function familyParameters(article, data) {
  const ids = data.families.find(f=>f.id===article.family)?.parameters || [];
  return ids.map(id=>data.parameters.find(p=>p.id===id)).filter(Boolean);
}

export function defaultValues(article, data) {
  return Object.fromEntries(familyParameters(article,data).map(p=>[p.id,p.value]));
}

export function formulaValues(article, data, configured = defaultValues(article,data)) {
  return Object.fromEntries(familyParameters(article,data).filter(p=>p.type!=='text').map(p=>[p.id,configured[p.id]]));
}

// Preserve compatible values and initialise only parameters newly assigned to a line.
export function reconcileLines(data) {
  for (const line of data.lines) {
    const article=data.articles.find(a=>a.id===line.article), old=line.values || {};
    line.values=Object.fromEntries(familyParameters(article,data).map(p=>{
      const value=old[p.id];
      const valid=['number','string'].includes(typeof value) && (p.type!=='number'||(value!=='' && Number.isFinite(Number(value)))) && (p.type!=='select'||p.options.includes(value));
      return [p.id,valid?value:p.value];
    }));
  }
  return data;
}

export function validateCatalog(data) {
  for (const article of data.articles) {
    const formulas=[article.formula,...data.tariffs.flatMap(t=>t.prices.filter(p=>p.article===article.id).map(p=>p.formula))];
    for (const formula of formulas) if (calculate(formula,formulaValues(article,data))<0) throw Error(`Precio negativo en ${article.id}`);
  }
  return data;
}

export function unitPrice(article, data, line) {
  const tariff = data.tariffs?.find(t => t.id === data.selectedTariff);
  const formula = tariff?.prices.find(p => p.article === article.id)?.formula || article.formula;
  const values = formulaValues(article,data,line?.values);
  const base = calculate(formula, values);
  const amount = base * (tariff?.multiplier ?? 1) * (1 - (tariff?.discount ?? 0) / 100);
  if (base < 0 || !Number.isFinite(amount) || amount < 0) throw Error('Precio no válido');
  return Math.round((amount + Number.EPSILON * Math.max(1, Math.abs(amount))) * 100) / 100;
}

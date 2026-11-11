import {emptyCompany} from './companies.js';
import {prepareImport} from './importer.js';
import {defaultValues} from './model.js';
import {freezeLine,rememberEstimate,estimateTotals} from './estimates.js';

const parameter=(codigo,nombre,tipo,valor,opciones='',modo_precio='',valores_precio='')=>({codigo,nombre,tipo,valor,opciones,modo_precio,valores_precio});
export const demoBusinesses = {
  fontaneria:{name:'Fontanería Hogar · Demo',file:'demo_fontaneria.xlsx',sheets:{
    Parametros:[parameter('horas','Tiempo de trabajo (h)','numero',1),parameter('precio_hora','Mano de obra (EUR/h)','numero',38),parameter('material','Materiales por intervención (EUR)','numero',25),parameter('metros','Longitud de tubería (m)','numero',3),parameter('precio_metro','Tubería y accesorios (EUR/m)','numero',12),parameter('equipo','Equipo o repuesto (EUR)','numero',95),parameter('urgencia','Horario de atención','lista','Laborable','Laborable|Urgente|Nocturno','coeficiente','1|1.3|1.6'),parameter('acabado','Gama del repuesto','lista','Estándar','Estándar|Superior','suplemento','0|45'),parameter('zona','Zona de desplazamiento','lista','Local','Local|Periferia|Fuera de zona','valor','20|35|55'),parameter('observaciones','Observaciones de la intervención','texto','Pendiente de visita')],
    Familias:[{codigo:'F-REPARACION',nombre:'Reparaciones domésticas',parametros:'horas|precio_hora|material|urgencia|observaciones'},{codigo:'F-TUBERIA',nombre:'Tuberías',parametros:'metros|precio_metro|horas|precio_hora|urgencia|observaciones'},{codigo:'F-SUSTITUCION',nombre:'Sustitución de equipos y grifería',parametros:'equipo|horas|precio_hora|acabado|urgencia|observaciones'},{codigo:'F-VISITA',nombre:'Visita y desplazamiento',parametros:'zona|observaciones'}],
    Articulos:[{codigo:'FON-001',nombre:'Reparar fuga accesible',familia:'F-REPARACION',formula:'horas * precio_hora + material'},{codigo:'FON-002',nombre:'Desatasco doméstico sencillo',familia:'F-REPARACION',formula:'horas * precio_hora + material'},{codigo:'FON-003',nombre:'Sustituir sifón o latiguillos',familia:'F-REPARACION',formula:'horas * precio_hora + material'},{codigo:'FON-004',nombre:'Instalar tubería vista por tramo',familia:'F-TUBERIA',formula:'metros * precio_metro + horas * precio_hora'},{codigo:'FON-005',nombre:'Sustituir grifo',familia:'F-SUSTITUCION',formula:'equipo + horas * precio_hora'},{codigo:'FON-006',nombre:'Sustituir mecanismo de cisterna',familia:'F-SUSTITUCION',formula:'equipo + horas * precio_hora'},{codigo:'FON-007',nombre:'Visita y desplazamiento (una por visita)',familia:'F-VISITA',formula:'zona'}]
  },cases:[['FON-001',{},63],['FON-004',{},74],['FON-005',{acabado:'Superior'},178],['FON-001',{urgencia:'Urgente'},81.9],['FON-007',{},20]]},
  electricidad:{name:'Electricidad Hogar · Demo',file:'demo_electricidad.xlsx',sheets:{
    Parametros:[parameter('horas','Tiempo de trabajo (h)','numero',1),parameter('precio_hora','Mano de obra (EUR/h)','numero',42),parameter('material','Materiales por intervención (EUR)','numero',18),parameter('metros','Longitud de cable (m)','numero',8),parameter('precio_metro','Cable y canalización (EUR/m)','numero',4),parameter('equipo','Equipo o mecanismo (EUR)','numero',30),parameter('urgencia','Horario de atención','lista','Laborable','Laborable|Urgente|Nocturno','coeficiente','1|1.35|1.7'),parameter('gama','Gama del mecanismo','lista','Básica','Básica|Diseño|Premium','suplemento','0|15|35'),parameter('zona','Zona de desplazamiento','lista','Local','Local|Periferia|Fuera de zona','valor','22|38|58'),parameter('observaciones','Observaciones de la intervención','texto','Pendiente de visita')],
    Familias:[{codigo:'E-AVERIA',nombre:'Averías y diagnóstico',parametros:'horas|precio_hora|material|urgencia|observaciones'},{codigo:'E-CABLEADO',nombre:'Cableado doméstico',parametros:'metros|precio_metro|horas|precio_hora|urgencia|observaciones'},{codigo:'E-MECANISMO',nombre:'Mecanismos y luminarias',parametros:'equipo|horas|precio_hora|gama|urgencia|observaciones'},{codigo:'E-VISITA',nombre:'Visita y desplazamiento',parametros:'zona|observaciones'}],
    Articulos:[{codigo:'ELE-001',nombre:'Diagnóstico y reparación de avería sencilla',familia:'E-AVERIA',formula:'horas * precio_hora + material'},{codigo:'ELE-002',nombre:'Revisar circuito doméstico',familia:'E-AVERIA',formula:'horas * precio_hora + material'},{codigo:'ELE-003',nombre:'Instalar tramo de cable y canalización',familia:'E-CABLEADO',formula:'metros * precio_metro + horas * precio_hora'},{codigo:'ELE-004',nombre:'Sustituir enchufe o interruptor',familia:'E-MECANISMO',formula:'equipo + horas * precio_hora'},{codigo:'ELE-005',nombre:'Instalar luminaria',familia:'E-MECANISMO',formula:'equipo + horas * precio_hora'},{codigo:'ELE-006',nombre:'Sustituir timbre',familia:'E-MECANISMO',formula:'equipo + horas * precio_hora'},{codigo:'ELE-007',nombre:'Visita y desplazamiento (una por visita)',familia:'E-VISITA',formula:'zona'}]
  },cases:[['ELE-001',{},60],['ELE-003',{},74],['ELE-004',{gama:'Premium'},107],['ELE-001',{urgencia:'Urgente'},81],['ELE-007',{},22]]},
  muebles:{
    name:'Taller de Muebles a Medida · Demo',
    file:'demo_muebles.xlsx',
    customer:'Vivienda de ejemplo · armario y librería',
    terms:'Presupuesto de demostración con precios ficticios. Medidas pendientes de comprobación en obra. El montaje se presupuesta por separado.',
    initialLines:[
      {id:'MUE-001',values:{ancho:1.8,alto:2.4,fondo:0.6,estantes:4,horas:8,herrajes:95}},
      {id:'MUE-002',values:{ancho:1.2,alto:2,fondo:0.3,estantes:5,horas:5,herrajes:25}},
      {id:'MUE-007',values:{horas:3}}
    ],
    sheets:{
      Parametros:[
        parameter('ancho','Ancho (m)','numero',1.2),
        parameter('alto','Alto (m)','numero',2),
        parameter('fondo','Fondo (m)','numero',0.5),
        parameter('estantes','Número de estantes','numero',3),
        parameter('tablero','Tablero (EUR/m²)','lista','Melamina','Melamina|Contrachapado|Roble chapado','valor','32|48|72'),
        parameter('acabado','Acabado','lista','Estándar','Estándar|Lacado','coeficiente','1|1.2'),
        parameter('herrajes','Herrajes (EUR)','numero',45),
        parameter('horas','Tiempo de trabajo (h)','numero',4),
        parameter('precio_hora','Mano de obra (EUR/h)','numero',38)
      ],
      Familias:[
        {codigo:'M-CUERPOS',nombre:'Armarios y estanterías',parametros:'ancho|alto|fondo|estantes|tablero|acabado|herrajes|horas|precio_hora'},
        {codigo:'M-FRENTES',nombre:'Puertas y paneles',parametros:'ancho|alto|tablero|acabado|herrajes|horas|precio_hora'},
        {codigo:'M-ENCIMERAS',nombre:'Encimeras',parametros:'ancho|fondo|tablero|acabado|horas|precio_hora'},
        {codigo:'M-SERVICIOS',nombre:'Servicios de taller y montaje',parametros:'horas|precio_hora'}
      ],
      Articulos:[
        {codigo:'MUE-001',nombre:'Armario con puertas abatibles',familia:'M-CUERPOS',formula:'(2 * alto * fondo + (2 + estantes) * ancho * fondo + 2 * ancho * alto) * tablero + herrajes + horas * precio_hora'},
        {codigo:'MUE-002',nombre:'Librería abierta',familia:'M-CUERPOS',formula:'(2 * alto * fondo + (2 + estantes) * ancho * fondo + ancho * alto) * tablero + herrajes + horas * precio_hora'},
        {codigo:'MUE-003',nombre:'Armario con puertas correderas',familia:'M-CUERPOS',formula:'(2 * alto * fondo + (2 + estantes) * ancho * fondo + 2 * ancho * alto) * tablero + herrajes + horas * precio_hora'},
        {codigo:'MUE-004',nombre:'Puerta de sustitución',familia:'M-FRENTES',formula:'ancho * alto * tablero + herrajes + horas * precio_hora'},
        {codigo:'MUE-005',nombre:'Panel decorativo a medida',familia:'M-FRENTES',formula:'ancho * alto * tablero + horas * precio_hora'},
        {codigo:'MUE-006',nombre:'Encimera de madera a medida',familia:'M-ENCIMERAS',formula:'ancho * fondo * tablero + horas * precio_hora'},
        {codigo:'MUE-007',nombre:'Montaje en vivienda',familia:'M-SERVICIOS',formula:'horas * precio_hora'}
      ]
    },
    cases:[['MUE-001',{},510.6],['MUE-002',{},433.8],['MUE-004',{tablero:'Roble chapado'},369.8],['MUE-005',{acabado:'Lacado'},274.56],['MUE-007',{horas:3},114]]
  }
};
export function demoWorkspace(kind) {
  const demo=demoBusinesses[kind];if(!demo)throw Error('Demo desconocida');
  const result=prepareImport(emptyCompany(demo.name),demo.sheets);if(result.errors.length)throw Error(result.errors.join('; '));
  const data=result.data;data.customer=demo.customer??'Vivienda de ejemplo';
  data.commercial.terms='DEMO: precios ficticios en EUR, sin impuestos. Materiales estimados sujetos a revisión tras visita. Desplazamiento una vez por visita. Confirmar alcance, condiciones e impuestos antes de enviar.';
  if(demo.terms)data.commercial.terms=demo.terms;
  const initialLines=demo.initialLines??[demo.sheets.Articulos[0],demo.sheets.Articulos.at(-1)].map(article=>({id:article.codigo}));
  for(const {id,values} of initialLines){
    const article=data.articles.find(a=>a.id===id);
    data.lines.push(freezeLine(data,{article:id,quantity:1,values:{...defaultValues(article,data),...values},discount:0}));
  }
  rememberEstimate(data);estimateTotals(data);return data;
}

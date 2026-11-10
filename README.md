# Configurador de presupuestos paramétricos

En el presupuesto se puede seleccionar una tarifa común o **Precio base (sin tarifa)**. Al elegir una tarifa del catálogo se conserva una copia de esa regla por línea para mantener los presupuestos guardados. Los precios unitarios se pueden editar directamente: el importe manual sustituye al cálculo completo de fórmula, opciones y tarifa, antes de cantidad, descuento de línea e impuestos. Se conserva al cambiar parámetros o tarifa. **Volver al calculado** elimina esa excepción. Ambos cambios permiten Deshacer y se conservan al guardar, duplicar e imprimir.

## Demo con varias empresas

En **Empresas** se pueden crear empresas vacías, cambiar el nombre y cargar las demos independientes de fontanería y electricidad a domicilio. También se puede cambiar de empresa desde la cabecera. Cada una conserva catálogo, parámetros, condiciones, datos de emisor y presupuestos propios. Al cambiar se limpia el historial de deshacer, la selección de líneas y la importación pendiente. La configuración anterior se conserva como primera empresa.

Los datos siguen guardándose solo en este navegador: esta función de demo no incorpora cuentas ni acceso compartido. La colección `imatia-companies-v1` es la fuente de datos; la clave anterior se mantiene como copia compatible de la empresa activa. Los cambios se confirman solo si se guarda la colección completa.

Los archivos `examples/demo_fontaneria.xlsx` y `examples/demo_electricidad.xlsx` contienen 10 parámetros, 4 familias y 7 servicios cada uno, con 5 comprobaciones de precio. Incluyen horas, materiales, desplazamiento, urgencia y gamas con precio. Son precios ficticios en EUR sin impuestos. Las tarifas están vacías y no son necesarias. Importar en una empresa vacía y revisar impuestos, emisor y condiciones antes de enviar un presupuesto. Los botones de demo crean además un presupuesto inicial de dos líneas.

Para regenerar estos Excel desde los datos de la demo: `node demo-excel.js --write`.

## Deshacer, cambios en bloque y opciones de precio

- **Deshacer** en la cabecera restaura la última modificación guardada: edición, eliminación, duplicación, importación o cambio en bloque. Conserva hasta 20 acciones durante la sesión. Guardar sin cambios no crea otra acción. Abrir un presupuesto desde el listado limpia el historial; recargar la página también lo limpia. Ctrl+Z fuera de los campos ejecuta Deshacer; dentro de un campo mantiene la edición nativa del navegador. Si el guardado falla no se consume la acción del historial.
- **Cambio en bloque**: marcar las casillas de las líneas (o Seleccionar todas), elegir un parámetro común e introducir el nuevo valor. Solo se ofrecen parámetros con el mismo identificador, nombre, tipo, opciones y reglas de precio en todas las líneas seleccionadas. Las líneas no seleccionadas y los demás valores se conservan. Si alguna línea no admite el valor o no puede calcularse, se rechaza la operación completa. Se deshace como una sola acción. La selección se limpia cuando cambia el presupuesto o la estructura de sus líneas.
- **Opciones de precio**: en Parámetros, crear o editar una Lista, introducir sus opciones y activar «Valores o ajustes de precio». Se admiten tres modos: suplemento por unidad (EUR), coeficiente y valor numérico para fórmula. Cada opción requiere un valor numérico no negativo. Los coeficientes usan 1 como valor neutro; los suplementos usan 0.

Orden de cálculo: `(resultado de fórmula + suma de suplementos) × producto de coeficientes`, seguido de los ajustes locales de precio anteriores, redondeo unitario y descuento de línea. Los parámetros de suplemento y coeficiente no se insertan en la fórmula para evitar aplicarlos dos veces. En el modo Valor numérico sí se utiliza el identificador: por ejemplo `ancho * alto * material`, donde Roble puede equivaler a 45 y Haya a 35.

Ejemplo rápido: artículo de precio fijo 100, opción Roble con suplemento 20 y opción Lacado con coeficiente 1.2 → precio unitario 144 EUR antes del descuento de línea e impuestos. Asignar esos parámetros a la familia y añadir una línea nueva para probarlos. Las líneas de presupuestos anteriores conservan sus definiciones y precios.

Las listas anteriores sin ajustes siguen funcionando. El JSON guarda los ajustes nuevos. En Excel se pueden añadir las columnas opcionales `modo_precio` (`suplemento`, `coeficiente` o `valor`) y `valores_precio` (números separados por `|`, en el orden de `opciones`). Por ejemplo: opciones `Haya|Roble`, modo `suplemento`, valores `10|20`. Si se omiten las columnas, se conservan los ajustes ya configurados; un modo vacío explícito los elimina.

Aplicación autónoma para preparar y guardar presupuestos rápidos, con catálogo paramétrico y PDF para el cliente. Requiere Node.js 20 o posterior.

## Ejecutar

```sh
npm ci
npm start
```

Abrir http://localhost:3000. Si ya estaba ejecutándose, detener el proceso con Ctrl+C y volver a arrancarlo: el servidor ha cambiado. Pruebas: `npm test`.

## Prueba de usuario con Excel

1. Abrir **Importar Excel** y descargar `00_configuracion_completa.xlsx` (también en `examples/`).
2. Seleccionar el archivo, revisar la vista previa y confirmar. Incluye 10 parámetros, 7 familias, 12 artículos, 3 tarifas y 12 precios específicos.
3. Alternativamente importar `01_parametros.xlsx`, `02_articulos.xlsx` y `03_tarifas.xlsx`, en ese orden.
4. En Presupuesto, eliminar las líneas anteriores y añadir Puerta lisa a medida (2 unidades), Kit de herrajes estándar (2) y Servicio de montaje (1).
5. Seleccionar GENERAL: total esperado **306,12 EUR**. Con PRO: **254,38 EUR**. Con PREMIUM: **411,36 EUR**. Mantener los valores iniciales importados.
6. La hoja **Pruebas** del archivo completo contiene seis escenarios y resultados esperados. Todos los archivos incluyen **Instrucciones**. La hoja **Pruebas_lineas** contiene dos puertas con anchos diferentes y dos montajes con horas diferentes; su total con tarifa GENERAL es **393,30 EUR** (cantidad 1 en cada línea).

Las importaciones Excel añaden y actualizan por código, preservando otros registros y las líneas del presupuesto. Los valores iniciales se actualizan para nuevas líneas. Las líneas existentes conservan sus valores compatibles; se inicializan parámetros nuevos y se retiran los que dejan de pertenecer a la familia. Los errores bloquean el archivo completo. Reimportar no duplica registros. Revisar la vista previa antes de confirmar la importación Excel.

## Formato de importación

Cabeceras en fila 1. Las hojas auxiliares se ignoran.

| Hoja | Columnas |
| --- | --- |
| Parametros | codigo, nombre, tipo, valor, opciones |
| Familias | codigo, nombre, parametros |
| Articulos | codigo, nombre, familia, formula |
| Tarifas | codigo, nombre, coeficiente, descuento |
| Precios | tarifa, articulo, formula |

Tipos: `numero`, `texto`, `lista` (también `number`, `text`, `select`). Opciones separadas con `|`; el valor inicial debe estar en la lista. Identificadores de parámetros: letras ASCII, números y guion bajo, empezando por letra o guion bajo. Distinguen mayúsculas y minúsculas.

Fórmulas como texto sin `=`: números, identificadores, `+ - * /` y paréntesis. No ejecutan JavaScript. Usar punto decimal en fórmulas. Se rechazan fórmulas nativas de Excel, objetos y enlaces dentro de los datos. Máximo 2 MB y 5000 filas por hoja importable. El servidor local procesa el archivo en memoria sin guardarlo.

## Tarifas y cálculo

Desde **Tarifas** se crean/actualizan condiciones y precios específicos por artículo. Un código de tarifa existente actualiza esa tarifa, conservando sus precios. Se pueden editar o quitar precios específicos.

Precio unitario = fórmula específica del artículo en tarifa (si no existe, fórmula base) × coeficiente × (1 − descuento / 100). Un descuento de 10 significa 10%. Sin tarifa se aplica la fórmula base sin ajustes. Los parámetros de texto son descriptivos; las listas participan en fórmulas cuando su valor es numérico. En el ejemplo, material es informativo y no modifica automáticamente coste_m2.

Precios unitarios redondeados a dos decimales antes de multiplicar por cantidad; líneas redondeadas a dos decimales. EUR con impuestos configurables (0% inicialmente). Los ajustes locales de precio anteriores se conservan. Los valores de los parámetros son independientes por línea: cambiar una medida solo recalcula esa línea.

## Almacenamiento y validación

Una configuración y varios presupuestos por navegador y origen, en localStorage. No hay cuentas ni datos compartidos. Borrar datos del navegador elimina el contenido. El servidor escucha solo en 127.0.0.1. El importador utiliza ExcelJS y package-lock.json fija las dependencias.

Las pruebas cubren los XLSX entregados, seis escenarios de precio, actualización sin duplicados, rechazo de errores sin mutación, JSON anterior y rutas del servidor. No sustituyen las pruebas manuales de interfaz.

## Familias y configuración por línea

- Definir los parámetros y sus valores iniciales en **Parámetros**.
- Crear una familia y seleccionar sus parámetros en **Familias**.
- Asignar una familia a cada artículo y usar solo sus parámetros en fórmulas base o de tarifa.
- Añadir el artículo al presupuesto. Cada línea copia sus propios valores iniciales y los guarda en JSON/localStorage. Dos líneas del mismo artículo pueden tener valores distintos.
- La configuración anterior se convierte a una familia General, copiando los valores a cada línea para mantener los precios.

En Excel, `Familias.parametros` contiene identificadores separados por `|`. `Articulos.familia` referencia su código. El archivo 01 incluye parámetros y familias; el 02 referencia esas familias. Los Excel anteriores sin columna familia se aceptan en General; los nuevos deben informar una familia válida. Cambiar los valores iniciales no cambia las líneas ya configuradas.

Al editar/importar familias se conservan valores compatibles, se añaden parámetros nuevos con su valor inicial y se retiran los ajenos a la nueva familia. Las opciones que dejan de ser válidas toman el valor inicial actualizado en líneas sin copia guardada. Los presupuestos con una copia de artículo conservan sus propias definiciones y valores. Revisar la configuración antes de modificar el catálogo.

## Generación rápida y gestión de presupuestos

- **Mis presupuestos**: listado con búsqueda por número/cliente y filtro de estado. Abrir o duplicar una oferta.
- **Nuevo**: crea un presupuesto vacío, con número automático P-AÑO-SECUENCIA, fecha actual y estado Borrador. La numeración es local al navegador; el número se puede editar, sin duplicados. Estados: Borrador, Enviado, Aceptado, Rechazado.
- **Guardar**: guarda el presupuesto completo. Los cambios válidos se guardan automáticamente; al cambiar de presupuesto se conserva el trabajo actual. Máximo 1000 presupuestos y límite real de almacenamiento del navegador. Si no se puede guardar, se informa del error y no se sustituye el estado actual.
- **Duplicar presupuesto / línea**: crea copias independientes con sus valores, cantidades, descuentos y condiciones. El presupuesto duplicado recibe nuevo identificador, número, fecha y estado Borrador; se limpia la fecha de validez.
- **Precios conservados**: cada línea copia la definición de artículo, parámetros y reglas locales de precio. Los cambios de catálogo no alteran presupuestos existentes; las líneas nuevas usan el catálogo actual. Duplicar conserva esas reglas para preparar variantes.
- **Búsqueda**: filtros por código, descripción y familia tanto en el catálogo como al añadir artículos. La búsqueda ignora acentos.
- **Asistente de fórmulas**: inserta parámetros y operadores en la posición del cursor y prueba el resultado con valores editables. Solo utiliza parámetros de la familia seleccionada.
- **Condiciones económicas**: descuento porcentual por línea, portes, un porcentaje de impuesto común, fecha de validez y texto comercial. Cada línea: precio unitario redondeado × cantidad → bruto redondeado → descuento redondeado → neto. Base = suma de netos + portes. Impuesto redondeado sobre esa base. Total = base + impuesto. No hay integración externa con tarifas ni ERP.
- **PDF**: solicita cliente, empresa emisora y al menos una línea válida. Incluye número, fecha, estado, validez, datos de emisor/cliente, artículos, cantidades, precios, descuentos, parámetros, portes, impuesto y condiciones. Se procesa en memoria en el servidor local y se descarga; no se archiva el PDF en el servidor.
- No hay controles para importar o exportar JSON. El guardado automático sigue siendo local al navegador.

Reiniciar el servidor después de actualizar e instalar dependencias con npm ci. PDFKit genera los documentos; jsdom se usa únicamente en pruebas de interfaz simulada. La suite incluye pruebas del modelo, importador, precios conservados, descuentos, recuperación, búsqueda, PDF multipágina, endpoints y recorrido de interfaz.

# Configurador de presupuestos paramétricos

Aplicación local para crear parámetros, artículos, tarifas y un presupuesto. Requiere Node.js 20 o posterior.

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

Las importaciones Excel añaden y actualizan por código, preservando otros registros y las líneas del presupuesto. Los valores iniciales se actualizan para nuevas líneas. Las líneas existentes conservan sus valores compatibles; se inicializan parámetros nuevos y se retiran los que dejan de pertenecer a la familia. Los errores bloquean el archivo completo. Reimportar no duplica registros. Exportar JSON como copia de seguridad antes de importar. La importación JSON sustituye todo el contenido, previa confirmación.

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

Precios unitarios redondeados a dos decimales antes de multiplicar por cantidad; líneas redondeadas a dos decimales. EUR sin impuestos. La tarifa es común al presupuesto. Los valores de los parámetros son independientes por línea: cambiar una medida solo recalcula esa línea.

## Almacenamiento y validación

Una configuración y un presupuesto por navegador y origen, en localStorage. No hay cuentas, datos compartidos ni histórico. Borrar datos del navegador elimina el contenido. El servidor escucha solo en 127.0.0.1. El importador utiliza ExcelJS y package-lock.json fija las dependencias.

Las pruebas cubren los XLSX entregados, seis escenarios de precio, actualización sin duplicados, rechazo de errores sin mutación, JSON anterior y rutas del servidor. No sustituyen las pruebas manuales de interfaz.

## Familias y configuración por línea

- Definir los parámetros y sus valores iniciales en **Parámetros**.
- Crear una familia y seleccionar sus parámetros en **Familias**.
- Asignar una familia a cada artículo y usar solo sus parámetros en fórmulas base o de tarifa.
- Añadir el artículo al presupuesto. Cada línea copia sus propios valores iniciales y los guarda en JSON/localStorage. Dos líneas del mismo artículo pueden tener valores distintos.
- La configuración anterior se convierte a una familia General, copiando los valores a cada línea para mantener los precios.

En Excel, `Familias.parametros` contiene identificadores separados por `|`. `Articulos.familia` referencia su código. El archivo 01 incluye parámetros y familias; el 02 referencia esas familias. Los Excel anteriores sin columna familia se aceptan en General; los nuevos deben informar una familia válida. Cambiar los valores iniciales no cambia las líneas ya configuradas.

Al editar/importar familias se conservan valores compatibles, se añaden parámetros nuevos con su valor inicial y se retiran los ajenos a la nueva familia. Las opciones que dejan de ser válidas toman el valor inicial actualizado. Exportar JSON antes de modificar el catálogo si se necesita conservar una versión anterior.

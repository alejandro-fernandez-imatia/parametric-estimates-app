import {buildEstimatePdf} from './pdf.js';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readExcel } from './excel.js';
export const files = { '/workflows.js':['workflows.js','text/javascript'], '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/model.js': ['model.js', 'text/javascript'], '/importer.js': ['importer.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'] };
files['/assets/imatia-logo.png'] = ['assets/imatia-logo.png', 'image/png'];
for (const name of ['00_configuracion_completa','01_parametros','02_articulos','03_tarifas']) files[`/examples/${name}.xlsx`] = [`examples/${name}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
files['/estimates.js']=['estimates.js','text/javascript'];
files['/estimate-ui.js']=['estimate-ui.js','text/javascript'];
const port = Number(process.env.PORT || 3000);
export const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if(req.method==='POST'&&path==='/api/pdf'){
    if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403).end();return;}
    try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2_000_000){res.writeHead(413).end('Máximo 2 MB');return;}chunks.push(chunk);}
      const pdf=await buildEstimatePdf(JSON.parse(Buffer.concat(chunks).toString('utf8')));res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="presupuesto.pdf"'}).end(pdf);
    }catch(error){res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'}).end(error.message);}return;
  }
  if (req.method === 'POST' && path === '/api/excel') {
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) { res.writeHead(403).end(); return; }
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 2_000_000) { res.writeHead(413).end('El archivo supera los 2 MB'); return; } chunks.push(chunk); }
      const sheets = await readExcel(Buffer.concat(chunks));
      res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(sheets));
    } catch (e) { res.writeHead(400, {'Content-Type':'text/plain; charset=utf-8'}).end(`Excel no válido: ${e.message}`); }
    return;
  }
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  const file = files[path];
  if (!file) { res.writeHead(404).end('Not found'); return; }
  try { res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8` }); res.end(await readFile(new URL(file[0], import.meta.url))); }
  catch { res.writeHead(500).end('No se pudo cargar la aplicación'); }
});
if (process.argv[1] && new URL(import.meta.url).pathname.toLowerCase().endsWith(process.argv[1].replaceAll('\\','/').toLowerCase())) server.listen(port, '127.0.0.1', () => console.log(`Aplicación disponible en http://localhost:${port}`));

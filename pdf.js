import PDFDocument from 'pdfkit';
import {validateWorkspace,estimateTotals,lineArticle,lineParameters,lineAmounts} from './estimates.js';
import {readFile} from 'node:fs/promises';

export async function buildEstimatePdf(input){
 const data=validateWorkspace(structuredClone(input));
 if(!data.customer.trim()||!data.issuer.name.trim()||!data.lines.length)throw Error('Indica cliente y empresa emisora, y añade al menos una línea.');
 const totals=estimateTotals(data),doc=new PDFDocument({size:'A4',margin:44,bufferPages:true,info:{Title:'Presupuesto '+data.estimate.number,Author:data.issuer.name}}),chunks=[];
 const result=new Promise((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 const left=44,width=doc.page.width-88,right=left+width,bottom=doc.page.height-62;
 const ink='#2C2A29',muted='#686460',accent='#D83B25',border='#DEDBD8';
 let y=44;
 const clean=value=>String(value??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
 const euro=n=>new Intl.NumberFormat('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+' EUR';
 const date=value=>value?value.split('-').reverse().join('/'):'';
 function style(size=10,bold=false,color=ink){doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(size).fillColor(color);}
 function at(text,x,top,w,size=10,bold=false,color=ink,align='left'){
  style(size,bold,color);doc.text(clean(text),x,top,{width:w,align,lineGap:2});
 }
 function rule(top=y){doc.moveTo(left,top).lineTo(right,top).lineWidth(.5).strokeColor(border).stroke();}
 function page(){doc.addPage();y=44;at('PRESUPUESTO',left,y,200,9,true,muted);at(data.estimate.number,right-210,y,210,9,false,muted,'right');y+=25;rule();y+=18;}
 function ensure(height){if(y+height>bottom)page();}
 // Split long content explicitly so paragraphs, configurations and conditions never overlap footers.
 function paragraph(value,{size=10,bold=false,color=ink,indent=0,w=width-indent}={}){
  const text=clean(value);style(size,bold,color);const lineHeight=size+5;
  for(const sourceLine of text.split('\n')){
   let line='';
   for(const word of sourceLine.split(/\s+/)){
    if(!word)continue;
    if(doc.widthOfString(line?line+' '+word:word)<=w){line=line?line+' '+word:word;continue;}
    if(line){ensure(lineHeight);at(line,left+indent,y,w,size,bold,color);y+=lineHeight;line='';style(size,bold,color);}
    // Break identifiers and long uninterrupted references as well as normal prose.
    let part='';for(const char of word){if(part&&doc.widthOfString(part+char)>w){ensure(lineHeight);at(part,left+indent,y,w,size,bold,color);y+=lineHeight;part='';style(size,bold,color);}part+=char;}line=part;
   }
   ensure(lineHeight);if(line)at(line,left+indent,y,w,size,bold,color);y+=lineHeight;style(size,bold,color);
  }
 }
 const logo=await readFile(new URL('assets/imatia-logo.png',import.meta.url));
 doc.image(logo,left-5,28,{fit:[112,55]});
 at('PRESUPUESTO',right-255,43,255,25,true,ink,'right');
 at(data.estimate.number,right-255,78,255,12,false,muted,'right');
 y=106;rule();y+=18;
 const meta=[['FECHA',date(data.estimate.date)],['ESTADO',data.estimate.status],['VALIDEZ',data.commercial.validUntil?date(data.commercial.validUntil):'Sin especificar']];
 meta.forEach(([label,value],i)=>{const x=left+i*width/3;at(label,x,y,width/3-10,8,true,muted);at(value,x,y+16,width/3-10,11,i===1,i===1&&value==='Anulado'?accent:ink);});
 y+=49;
 const issuer=[data.issuer.taxId,data.issuer.address,data.issuer.email,data.issuer.phone].filter(Boolean).join('\n');
 const client=data.commercial.customerDetails;
 const col=(width-32)/2;
 style(10,true);const nameHeight=Math.max(doc.heightOfString(clean(data.issuer.name),{width:col}),doc.heightOfString(clean(data.customer),{width:col}));
 style(9);const detailHeight=Math.max(doc.heightOfString(clean(issuer),{width:col,lineGap:3}),doc.heightOfString(clean(client),{width:col,lineGap:3}));
 if(nameHeight+detailHeight<180){
  at('EMPRESA',left,y,col,8,true,muted);at('CLIENTE',left+col+32,y,col,8,true,muted);y+=19;
  at(data.issuer.name,left,y,col,12,true);at(data.customer,left+col+32,y,col,12,true);
  style(12,true);y+=Math.max(doc.heightOfString(clean(data.issuer.name),{width:col,lineGap:2}),doc.heightOfString(clean(data.customer),{width:col,lineGap:2}))+8;
  at(issuer,left,y,col,9,false,muted);at(client,left+col+32,y,col,9,false,muted);style(9);y+=detailHeight+15;
 }else{
  paragraph('EMPRESA',{size:8,bold:true,color:muted});paragraph(data.issuer.name,{size:12,bold:true});if(issuer)paragraph(issuer,{size:9,color:muted});y+=12;
  paragraph('CLIENTE',{size:8,bold:true,color:muted});paragraph(data.customer,{size:12,bold:true});if(client)paragraph(client,{size:9,color:muted});y+=20;
 }
 ensure(70);paragraph('DETALLE DEL PRESUPUESTO',{size:9,bold:true});y+=7;rule();y+=17;
 const columns=[['Cantidad',left,65],['Precio unitario',left+93,135],['Dto.',left+254,60],['Importe neto',left+340,width-340]];
 for(let index=0;index<data.lines.length;index++){
  const line=data.lines[index],article=lineArticle(data,line),amount=lineAmounts(data,line);
  const parameters=lineParameters(data,line);
  style(9);let configurationHeight=0;for(let i=0;i<parameters.length;i+=2)configurationHeight+=Math.max(...parameters.slice(i,i+2).map(p=>doc.heightOfString(clean(p.name+': '+line.values[p.id]),{width:col,lineGap:2})))+4;
  style(12,true);const titleHeight=doc.heightOfString(clean(article.name),{width:width-25,lineGap:2});
  const blockHeight=titleHeight+100+configurationHeight;
  ensure(Math.min(blockHeight,bottom-90));
  paragraph(String(index+1).padStart(2,'0')+'  '+article.name,{size:12,bold:true});
  paragraph(article.id+' / '+(line.snapshot?.familyName||data.families.find(f=>f.id===article.family)?.name||''),{size:8,color:muted});y+=6;
  ensure(42);
  const values=[String(line.quantity),euro(amount.unit),(line.discount??0)+'%',euro(amount.net)];
  let priceHeight=14;
  columns.forEach(([label,x,w],i)=>{at(label.toUpperCase(),x,y,w,7.5,true,muted,i?'right':'left');style(11,i===3);priceHeight=Math.max(priceHeight,doc.heightOfString(values[i],{width:w,lineGap:2}));at(values[i],x,y+15,w,11,i===3,ink,i?'right':'left');});
  y+=18+priceHeight+6;
  for(let i=0;i<parameters.length;i+=2){
   const pair=parameters.slice(i,i+2).map(p=>p.name+': '+line.values[p.id]);
   style(9);const heights=pair.map(t=>doc.heightOfString(clean(t),{width:col,lineGap:2}));const h=Math.max(...heights)+4;
   if(h>150){for(const t of pair)paragraph(t,{size:9,color:muted});}
   else{ensure(h);pair.forEach((t,j)=>at(t,left+j*(col+32),y,col,9,false,muted));y+=h;}
  }
  y+=6;ensure(8);rule();y+=16;
 }
 ensure(200);
 const summaryTop=y;
 style(9);const termsBeside=data.commercial.terms&&doc.heightOfString(clean(data.commercial.terms),{width:width*.38,lineGap:3})<150;
 if(termsBeside){paragraph('CONDICIONES COMERCIALES',{size:8,bold:true,color:muted,w:width*.38});y+=7;paragraph(data.commercial.terms,{size:9,color:muted,w:width*.38});y=summaryTop;}
 const tx=left+width*.45,tw=width*.55;
 at('RESUMEN ECONÓMICO',tx,y,tw,8,true,muted);y+=24;
 for(const [label,value] of [['Importe bruto',totals.gross],['Descuentos',-totals.discount],['Portes',totals.shipping],['Base imponible',totals.base],['Impuesto ('+totals.tax+'%)',totals.taxAmount]]){
  at(label,tx,y,tw*.54,9,false,muted);at(euro(value),tx+tw*.54,y,tw*.46,10,false,ink,'right');y+=21;
 }
 doc.moveTo(tx,y+2).lineTo(right,y+2).lineWidth(.8).strokeColor(ink).stroke();y+=15;
 at('TOTAL',tx,y+5,60,10,true);at(euro(totals.total),tx+65,y,tw-65,21,true,ink,'right');y+=52;
 if(data.commercial.terms&&!termsBeside){ensure(65);paragraph('CONDICIONES COMERCIALES',{size:8,bold:true,color:muted});y+=7;paragraph(data.commercial.terms,{size:9,color:muted});}
 const range=doc.bufferedPageRange();
 for(let p=range.start;p<range.start+range.count;p++){
  doc.switchToPage(p);const margin=doc.page.margins.bottom;doc.page.margins.bottom=0;
  const fy=doc.page.height-42;doc.moveTo(left,fy-10).lineTo(right,fy-10).lineWidth(.5).strokeColor(border).stroke();
  at(data.estimate.number,left,fy,width-100,8,false,muted);at(String(p+1)+' / '+range.count,right-80,fy,80,8,false,muted,'right');doc.page.margins.bottom=margin;
 }
 doc.end();return result;
}

import PDFDocument from 'pdfkit';
import {validateWorkspace,estimateTotals,lineArticle,lineParameters,lineAmounts} from './estimates.js';
import {readFile} from 'node:fs/promises';

export async function buildEstimatePdf(input){
 const data=validateWorkspace(structuredClone(input));
 if(!data.customer.trim()||!data.issuer.name.trim()||!data.lines.length)throw Error('Indica cliente y empresa emisora, y añade al menos una línea.');
 const totals=estimateTotals(data),doc=new PDFDocument({size:'A4',margin:44,bufferPages:true,info:{Title:`Presupuesto ${data.estimate.number}`,Author:data.issuer.name}}),chunks=[];
 const result=new Promise((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 const width=doc.page.width-88,bottom=doc.page.height-56;
 const euro=n=>new Intl.NumberFormat('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+' EUR';
 const clean=value=>String(value??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
 const text=(value,size=10,options={})=>{doc.fontSize(size).fillColor('#2C2A29').text(clean(value),44,doc.y,{width,...options});};
 const space=n=>{if(doc.y+n>bottom)doc.addPage();};
 const rule=()=>{doc.moveTo(44,doc.y).lineTo(44+width,doc.y).strokeColor('#E3E1E0').stroke();doc.y+=12;};
 const logo=await readFile(new URL('assets/imatia-logo.png',import.meta.url));
 doc.image(logo,38,20,{fit:[130,65]});doc.y=82;
 doc.font('Helvetica-Bold');text('PRESUPUESTO',23);doc.moveDown(.5);
 text(data.estimate.number,13);doc.font('Helvetica');text(`Fecha: ${data.estimate.date}    Estado: ${data.estimate.status}`,10);
 if(data.commercial.validUntil)text(`Validez hasta: ${data.commercial.validUntil}`,10);
 doc.moveDown();rule();
 doc.font('Helvetica-Bold');text(data.issuer.name,12);doc.font('Helvetica');
 text([data.issuer.taxId,data.issuer.address,data.issuer.email,data.issuer.phone].filter(Boolean).join(' · '),10);
 doc.moveDown();doc.font('Helvetica-Bold');text('CLIENTE',10);text(data.customer,12);doc.font('Helvetica');if(data.commercial.customerDetails)text(data.commercial.customerDetails,10);
 doc.moveDown();rule();
 for(let index=0;index<data.lines.length;index++){
  const line=data.lines[index],article=lineArticle(data,line),amount=lineAmounts(data,line);
  space(112);doc.font('Helvetica-Bold');text(`${index+1}. ${article.name}`,12);doc.font('Helvetica');
  text(`${article.id} · ${line.snapshot?.familyName||data.families.find(f=>f.id===article.family)?.name||''}`,9);doc.moveDown(.4);
  const y=doc.y,columns=[['Cantidad',String(line.quantity),0,72],['Precio unitario',euro(amount.unit),88,125],['Descuento',`${line.discount??0}%`,230,86],['Importe',euro(amount.net),330,width-330]];
  for(const [label,value,x,w] of columns){doc.fillColor('#686460').fontSize(8).text(label,44+x,y,{width:w});doc.fillColor('#2C2A29').fontSize(11).text(value,44+x,y+14,{width:w});}
  doc.y=y+36;
  for(const p of lineParameters(data,line)){
   space(28);text(`${p.name}: ${line.values[p.id]}`,9,{lineGap:2});
  }
  doc.moveDown(.6);rule();
 }
 space(170);doc.font('Helvetica');
 for(const [label,value] of [['Importe bruto',totals.gross],['Descuentos',-totals.discount],['Portes',totals.shipping],['Base',totals.base],[`Impuesto (${totals.tax}%)`,totals.taxAmount]]){
  const y=doc.y;doc.fontSize(10).fillColor('#2C2A29').text(label,280,y,{width:140});doc.text(euro(value),420,y,{width:doc.page.width-464,align:'right'});doc.y=y+19;
 }
 doc.moveDown(.4);const y=doc.y;doc.rect(280,y,doc.page.width-324,36).fill('#2C2A29');doc.font('Helvetica-Bold').fillColor('#FFFFFF').fontSize(12).text('TOTAL',290,y+11,{width:70});doc.text(euro(totals.total),360,y+11,{width:doc.page.width-414,align:'right'});doc.y=y+54;
 if(data.commercial.terms){space(70);doc.font('Helvetica-Bold');text('CONDICIONES COMERCIALES',11);doc.moveDown(.5);doc.font('Helvetica');text(data.commercial.terms,10,{lineGap:3});}
 const range=doc.bufferedPageRange();
 for(let page=range.start;page<range.start+range.count;page++){doc.switchToPage(page);const margin=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.font('Helvetica').fontSize(8).fillColor('#686460').text(`${data.estimate.number} · ${page+1} / ${range.count}`,44,doc.page.height-35,{width,align:'right',lineBreak:false});doc.page.margins.bottom=margin;}
 doc.end();return result;
}

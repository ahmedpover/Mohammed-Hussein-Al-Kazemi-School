/* Native OOXML export: no external CDN, package, or CSV delimiter dependency. */
const enc = new TextEncoder();
const xmlEscape = v => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const col = index => { let s=''; for (let x=index; x>0; x=Math.floor((x-1)/26)) s=String.fromCharCode(65+(x-1)%26)+s; return s; };
const cell = (c,r,v,style=0) => typeof v === 'number' && Number.isFinite(v)
 ? `<c r="${col(c)}${r}" s="${style}"><v>${v}</v></c>`
 : `<c r="${col(c)}${r}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
const row = (r, entries, height) => `<row r="${r}"${height ? ` ht="${height}" customHeight="1"` : ''}>${entries.map(([c,v,s])=>cell(c,r,v,s)).join('')}</row>`;
const sum = (items,key) => items.reduce((a,b)=>a+(Number(b[key])||0),0);
function sheetXml(group,month){
 const students=Array.isArray(group.students)?group.students:[];
 const number=students.length,abs=sum(students,'absences'),late=sum(students,'delays'),present=sum(students,'presents');
 const rows=[
  row(1,[[1,'مدرسة الشيخ محمد حسين الكاظمي',1]],38),
  row(2,[[1,'التقرير الشهري للحضور والغياب',2]],30),
  row(3,[[1,`الشعبة: ${group.name||'بدون اسم'}`,3],[4,`الشهر: ${month||''}`,3]],28),
  row(4,[[1,`عدد الطلاب: ${number}`,4],[3,`الغيابات: ${abs}`,4],[5,`التأخيرات: ${late}`,4]],26),
  row(5,[],11),
  row(6,[[1,'ت',5],[2,'اسم الطالب',5],[3,'الغيابات',5],[4,'التأخيرات',5],[5,'الحضور',5],[6,'مجموع السجلات',5]],32)
 ];
 students.forEach((s,i)=>{const r=i+7,a=Number(s.absences)||0,l=Number(s.delays)||0,p=Number(s.presents)||0;const base=i%2?7:6;
  rows.push(row(r,[[1,i+1,base],[2,s.name||'',base],[3,a,a?8:base],[4,l,l?9:base],[5,p,base],[6,a+l+p,base]],27));
 });
 const totalRow=7+students.length;
 rows.push(row(totalRow,[[1,'المجموع',10],[3,abs,11],[4,late,11],[5,present,11],[6,abs+late+present,11]],32));
 rows.push(row(totalRow+2,[[1,'ملاحظة: كل تأخير يُحسب مستقلاً، ولا تُحتسب إلا السجلات المعتمدة.',12]],24));
 const range=`A1:F${totalRow+2}`;
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
 `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`+
 `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="${range}"/>`+
 `<sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>`+
 `<sheetFormatPr defaultRowHeight="21"/>`+
 `<cols><col min="1" max="1" width="9" customWidth="1"/><col min="2" max="2" width="43" customWidth="1"/><col min="3" max="5" width="17" customWidth="1"/><col min="6" max="6" width="19" customWidth="1"/></cols>`+
 `<sheetData>${rows.join('')}</sheetData>`+
 `<mergeCells count="7"><mergeCell ref="A1:F1"/><mergeCell ref="A2:F2"/><mergeCell ref="A3:C3"/><mergeCell ref="D3:F3"/><mergeCell ref="A4:B4"/><mergeCell ref="C4:D4"/><mergeCell ref="E4:F4"/></mergeCells>`+

 `<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>`+
 `<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>`+
 `</worksheet>`;
}
const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`+
 `<fonts count="6"><font><sz val="11"/><name val="Arial"/><color rgb="FF253C32"/></font>`+
 `<font><b/><sz val="18"/><name val="Arial"/><color rgb="FFFFFFFF"/></font>`+
 `<font><b/><sz val="13"/><name val="Arial"/><color rgb="FF204A3B"/></font>`+
 `<font><b/><sz val="11"/><name val="Arial"/><color rgb="FFFFFFFF"/></font>`+
 `<font><b/><sz val="11"/><name val="Arial"/><color rgb="FF9B2929"/></font>`+
 `<font><b/><sz val="11"/><name val="Arial"/><color rgb="FF916617"/></font></fonts>`+
 `<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>`+
 `<fill><patternFill patternType="solid"><fgColor rgb="FF193F34"/><bgColor indexed="64"/></patternFill></fill>`+
 `<fill><patternFill patternType="solid"><fgColor rgb="FFF8F6EF"/><bgColor indexed="64"/></patternFill></fill>`+
 `<fill><patternFill patternType="solid"><fgColor rgb="FFB69A60"/><bgColor indexed="64"/></patternFill></fill>`+
 `<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>`+
 `<fill><patternFill patternType="solid"><fgColor rgb="FFF4F4EF"/><bgColor indexed="64"/></patternFill></fill></fills>`+
 `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>`+
 `<border><left style="hair"><color rgb="FFDDDCD3"/></left><right style="hair"><color rgb="FFDDDCD3"/></right><top style="hair"><color rgb="FFDDDCD3"/></top><bottom style="hair"><color rgb="FFDDDCD3"/></bottom><diagonal/></border></borders>`+
 `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`+
 `<cellXfs count="13">`+
 `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`+
 `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`+
 `<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`+
 `<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`+
 `<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`+
 `<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`+
 `<xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`+
 `<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`+
 `<xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`+
 `<xf numFmtId="0" fontId="5" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`+
 `<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`+
 `<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`+
 `<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>`+
 `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
function sheetName(name,index,used){
 let result=String(name||`شعبة ${index+1}`).replace(/[\\/*?:\[\]]/g,' ').replace(/^'+|'+$/g,'').trim().slice(0,31)||`شعبة ${index+1}`;
 const base=result;let n=2;while(used.has(result.toLowerCase())){const suffix=` (${n++})`;result=base.slice(0,31-suffix.length)+suffix;}used.add(result.toLowerCase());return result;
}
function zipStore(files){
 const local=[],central=[];let offset=0;
 const u16=(view,o,v)=>view.setUint16(o,v,true),u32=(view,o,v)=>view.setUint32(o,v>>>0,true);
 const crcTable=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[i]=c>>>0;}
 const crc32=data=>{let crc=0xffffffff;for(const b of data)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
 for(const [name,source] of files){const filename=enc.encode(name),body=enc.encode(source),crc=crc32(body);
 const lh=new Uint8Array(30+filename.length),lv=new DataView(lh.buffer);u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x800);u16(lv,8,0);u32(lv,14,crc);u32(lv,18,body.length);u32(lv,22,body.length);u16(lv,26,filename.length);lh.set(filename,30);local.push(lh,body);
 const ch=new Uint8Array(46+filename.length),cv=new DataView(ch.buffer);u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x800);u32(cv,16,crc);u32(cv,20,body.length);u32(cv,24,body.length);u16(cv,28,filename.length);u32(cv,42,offset);ch.set(filename,46);central.push(ch);offset+=lh.length+body.length;
 }
 const centralSize=central.reduce((v,c)=>v+c.length,0),footer=new Uint8Array(22),fv=new DataView(footer.buffer);u32(fv,0,0x06054b50);u16(fv,8,files.length);u16(fv,10,files.length);u32(fv,12,centralSize);u32(fv,16,offset);
 return new Blob([...local,...central,footer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export function makeAttendanceWorkbook(report){
 const groups=Array.isArray(report?.groups)?report.groups:[];if(!groups.length)throw new Error('لا توجد شعب لتصديرها.');
 const used=new Set(),names=groups.map((g,i)=>sheetName(g.name,i,used));
 const files=[
 ['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${groups.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
 ['_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
 ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${names.map((n,i)=>`<sheet name="${xmlEscape(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
 ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${groups.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${groups.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
 ['xl/styles.xml',styles],
 ...groups.map((g,i)=>[`xl/worksheets/sheet${i+1}.xml`,sheetXml(g,report.month)])
 ];return zipStore(files);
}

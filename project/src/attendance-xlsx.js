const xmlEscape = value => String(value ?? '')
  .replace(/&/g,'&amp;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;')
  .replace(/'/g,'&apos;');

const sum = (items,key) => items.reduce((a,b)=>a+(Number(b?.[key])||0),0);

function cell(value,{type='String',style='Cell',mergeAcross=0}={}){
  const attrs=[`ss:StyleID="${style}"`];
  if(mergeAcross) attrs.push(`ss:MergeAcross="${mergeAcross}"`);
  if(value===null || value===undefined || value==='') return `<Cell ${attrs.join(' ')} />`;
  return `<Cell ${attrs.join(' ')}><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`;
}

function blank(count){return new Array(count).fill('<Cell ss:StyleID="Cell" />').join('');}

function worksheetXml(group,month){
  const students=Array.isArray(group?.students)?group.students:[];
  const abs=sum(students,'absences');
  const late=sum(students,'delays');
  const present=sum(students,'presents');
  const totalLessons=abs+late+present;
  const rows=[];
  rows.push(`<Row ss:Height="26">${cell('مدرسة الشيخ محمد حسين الكاظمي',{style:'Title',mergeAcross:5})}</Row>`);
  rows.push(`<Row ss:Height="22">${cell('التقرير الشهري للحضور والغياب',{style:'SubTitle',mergeAcross:5})}</Row>`);
  rows.push(`<Row ss:Height="6">${blank(6)}</Row>`);
  rows.push(`<Row>${cell(`الشعبة: ${group?.name || 'بدون اسم'}`,{style:'Meta',mergeAcross:2})}${blank(0)}${cell(`الشهر: ${month || ''}`,{style:'Meta',mergeAcross:2})}</Row>`);
  rows.push(`<Row>${cell(`عدد الطلاب: ${students.length}`,{style:'Meta',mergeAcross:1})}${blank(0)}${cell(`الغيابات: ${abs}`,{style:'Meta',mergeAcross:1})}${cell(`التأخيرات: ${late}`,{style:'Meta',mergeAcross:1})}${cell(`الحضور: ${present}`,{style:'Meta',mergeAcross:1})}</Row>`);
  rows.push(`<Row ss:AutoFitHeight="0" ss:Height="24">${cell('التسلسل',{style:'Header'})}${cell('اسم الطالب',{style:'Header'})}${cell('الغيابات',{style:'Header'})}${cell('التأخيرات',{style:'Header'})}${cell('الحضور',{style:'Header'})}${cell('مجموع الدروس',{style:'Header'})}</Row>`);
  students.forEach((student,index)=>{
    const a=Number(student?.absences)||0;
    const d=Number(student?.delays)||0;
    const pr=Number(student?.presents)||0;
    const style=index%2===0?'CellAlt':'Cell';
    rows.push(`<Row>${cell(index+1,{style,type:'Number'})}${cell(student?.name || '',{style})}${cell(a,{style:a?'Absence':'Number',type:'Number'})}${cell(d,{style:d?'Delay':'Number',type:'Number'})}${cell(pr,{style:'Number',type:'Number'})}${cell(a+d+pr,{style:'Number',type:'Number'})}</Row>`);
  });
  rows.push(`<Row>${cell('المجموع',{style:'Total',mergeAcross:1})}${blank(0)}${cell(abs,{style:'TotalNum',type:'Number'})}${cell(late,{style:'TotalNum',type:'Number'})}${cell(present,{style:'TotalNum',type:'Number'})}${cell(totalLessons,{style:'TotalNum',type:'Number'})}</Row>`);
  rows.push(`<Row>${cell('ملاحظة: كل تأخير يُحسب مستقلاً، ولا تُحتسب إلا السجلات المعتمدة.',{style:'Foot',mergeAcross:5})}</Row>`);
  return `
  <Worksheet ss:Name="${xmlEscape(sheetName(group?.name||'شعبة'))}">
    <Table ss:ExpandedColumnCount="6" ss:ExpandedRowCount="${rows.length}" x:FullColumns="1" x:FullRows="1" ss:DefaultColumnWidth="90" ss:DefaultRowHeight="20">
      <Column ss:Index="1" ss:AutoFitWidth="0" ss:Width="55"/>
      <Column ss:Index="2" ss:AutoFitWidth="0" ss:Width="240"/>
      <Column ss:Index="3" ss:AutoFitWidth="0" ss:Width="90"/>
      <Column ss:Index="4" ss:AutoFitWidth="0" ss:Width="90"/>
      <Column ss:Index="5" ss:AutoFitWidth="0" ss:Width="90"/>
      <Column ss:Index="6" ss:AutoFitWidth="0" ss:Width="105"/>
      ${rows.join('')}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <DisplayRightToLeft/>
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>6</SplitHorizontal>
      <TopRowBottomPane>6</TopRowBottomPane>
      <ActivePane>2</ActivePane>
      <Panes><Pane><Number>2</Number></Pane></Panes>
      <ProtectObjects>False</ProtectObjects>
      <ProtectScenarios>False</ProtectScenarios>
    </WorksheetOptions>
  </Worksheet>`;
}

function sheetName(name){
  return String(name || 'شعبة').replace(/[\/*?:\[\]]/g,' ').trim().slice(0,31) || 'شعبة';
}

export function makeAttendanceWorkbook(report){
  const groups=Array.isArray(report?.groups)?report.groups:[];
  if(!groups.length) throw new Error('لا توجد شعب لتصديرها.');
  const worksheets=groups.map(group=>worksheetXml(group,report?.month||'')).join('');
  const xml=`<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>OpenAI</Author>
  <LastAuthor>OpenAI</LastAuthor>
  <Created>${new Date().toISOString()}</Created>
  <Company>مدرسة الشيخ محمد حسين الكاظمي</Company>
  <Version>16.00</Version>
 </DocumentProperties>
 <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
  <WindowHeight>12000</WindowHeight>
  <WindowWidth>20000</WindowWidth>
  <WindowTopX>0</WindowTopX>
  <WindowTopY>0</WindowTopY>
  <ProtectStructure>False</ProtectStructure>
  <ProtectWindows>False</ProtectWindows>
 </ExcelWorkbook>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center" ss:Horizontal="Center" ss:ReadingOrder="2"/>
   <Borders/>
   <Font ss:FontName="Arial" ss:Size="11" ss:Color="#253C32"/>
   <Interior/>
  </Style>
  <Style ss:ID="Title">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="2"/>
   <Font ss:FontName="Arial" ss:Size="18" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#193F34" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SubTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="2"/>
   <Font ss:FontName="Arial" ss:Size="13" ss:Bold="1" ss:Color="#204A3B"/>
   <Interior ss:Color="#F8F6EF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Meta">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="2"/>
   <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#204A3B"/>
   <Interior ss:Color="#F8F6EF" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDCD3"/></Borders>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="2"/>
   <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#B69A60" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDCD3"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDCD3"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDCD3"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDCD3"/></Borders>
  </Style>
  <Style ss:ID="Cell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="2"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/></Borders>
  </Style>
  <Style ss:ID="CellAlt">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="2"/>
   <Interior ss:Color="#F4F4EF" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/></Borders>
  </Style>
  <Style ss:ID="Number">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="2"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/></Borders>
   <NumberFormat ss:Format="0"/>
  </Style>
  <Style ss:ID="Absence">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="2"/>
   <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#9B2929"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/></Borders>
   <NumberFormat ss:Format="0"/>
  </Style>
  <Style ss:ID="Delay">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="2"/>
   <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#916617"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7E4DA"/></Borders>
   <NumberFormat ss:Format="0"/>
  </Style>
  <Style ss:ID="Total">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="2"/>
   <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#204A3B"/>
   <Interior ss:Color="#F8F6EF" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDCD3"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDCD3"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDCD3"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDCD3"/></Borders>
  </Style>
  <Style ss:ID="TotalNum">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="2"/>
   <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#204A3B"/>
   <Interior ss:Color="#F8F6EF" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDCD3"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDCD3"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDCD3"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDCD3"/></Borders>
   <NumberFormat ss:Format="0"/>
  </Style>
  <Style ss:ID="Foot">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:ReadingOrder="2"/>
   <Font ss:FontName="Arial" ss:Size="10" ss:Color="#4B544F"/>
  </Style>
 </Styles>
 ${worksheets}
</Workbook>`;
  return new Blob([new Uint8Array([0xEF,0xBB,0xBF]), xml], {type:'application/vnd.ms-excel'});
}

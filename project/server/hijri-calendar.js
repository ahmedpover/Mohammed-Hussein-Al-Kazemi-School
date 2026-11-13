// One school-wide Hijri calendar. Calculated seed dates are PROVISIONAL, never official moon-sighting announcements.
export const HIJRI_NAMES = ['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
const DAY = 86400000;
export const addDays = (date,days) => new Date(Date.parse(date+'T00:00:00Z')+days*DAY).toISOString().slice(0,10);
export const daysBetween = (first,last) => Math.round((Date.parse(last+'T00:00:00Z')-Date.parse(first+'T00:00:00Z'))/DAY)+1;
export const calendarParts = (date) => {
  const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric'});
  const items=Object.fromEntries(formatter.formatToParts(new Date(date+'T00:00:00Z')).map(p=>[p.type,p.value]));
  return {year:Number(items.year),month:Number(items.month),day:Number(items.day)};
};
export function forecastYear(year){
  if(!Number.isInteger(year)||year<1300||year>1600)throw new Error('السنة الهجرية غير صحيحة.');
  const approximateGregorian=Math.floor(621.5774+year*0.970224);
  let cursor=`${approximateGregorian-2}-01-01`;
  const months=[];
  for(let i=0;i<1600&&months.length<13;i++,cursor=addDays(cursor,1)){
    const p=calendarParts(cursor);
    if(p.year===year&&p.day===1&&p.month===months.length+1)months.push({year,month:p.month,startDate:cursor});
    if(p.year===year+1&&p.day===1&&p.month===1&&months.length===12){months.push({year:year+1,month:1,startDate:cursor});break;}
  }
  if(months.length!==13)throw new Error('تعذّر تجهيز التقويم التقديري لهذه السنة.');
  return months.slice(0,12).map((m,i)=>({...m,endDate:addDays(months[i+1].startDate,-1),days:daysBetween(m.startDate,addDays(months[i+1].startDate,-1)),confirmed:false,sourceUrl:''}));
}
export function reflowMonths(months,index,newDays,newStart){
  if(!Number.isInteger(index)||index<0||index>=months.length||![29,30].includes(newDays))throw new Error('اختيار الشهر أو عدد الأيام غير صحيح.');
  const result=months.map(x=>({...x}));
  let date=newStart||result[index].startDate;
  if(index>0){
    const previous=result[index-1],duration=daysBetween(previous.startDate,addDays(date,-1));
    if(![29,30].includes(duration))throw new Error('تغيير بداية هذا الشهر يتطلب تعديل نهاية الشهر السابق أولاً.');
    const previousEnd=addDays(date,-1);
    if(previousEnd!==previous.endDate) previous.confirmed=false;
    previous.endDate=previousEnd;previous.days=duration;
  }
  for(let i=index;i<result.length;i++){
    const duration=i===index?newDays:result[i].days;
    result[i].startDate=date;
    result[i].endDate=addDays(date,duration-1);
    result[i].days=duration;
    if(i>index && (date!==months[i].startDate || result[i].endDate!==months[i].endDate))result[i].confirmed=false;
    date=addDays(result[i].endDate,1);
  }
  return result;
}
export async function loadSchoolHijriYear(query,year){
  const calculated=forecastYear(year);
  const {rows}=await query('SELECT hijri_year AS year,hijri_month AS month,start_date::text AS "startDate",end_date::text AS "endDate",source_url AS "sourceUrl",confirmed FROM attendance_hijri_months WHERE hijri_year=$1 ORDER BY hijri_month',[year]);
  const saved=new Map(rows.map(r=>[Number(r.month),r]));
  const duration=(r)=>daysBetween(r.startDate,r.endDate);
  // Existing manually entered months are honored; fill gaps using a contiguous sequence.
  // A corrected previous year's final month anchors the next year, too.
  if(!saved.size){
    const {rows:prior}=await query(`SELECT end_date::text AS finish FROM attendance_hijri_months WHERE hijri_year=$1 AND hijri_month=12`,[year-1]);
    if(!prior.length)return calculated;
    let date=addDays(prior[0].finish,1);
    return calculated.map(m=>{const item={...m,startDate:date,endDate:addDays(date,m.days-1)};date=addDays(item.endDate,1);return item;});
  }
  const anchor=rows[0];
  let first=anchor.startDate;
  for(let i=Number(anchor.month)-2;i>=0;i--)first=addDays(first,-calculated[i].days);
  const merged=[];let cursor=first;
  for(const month of calculated){
    const existing=saved.get(month.month);
    const days=existing?duration(existing):month.days;
    merged.push({...month,startDate:cursor,endDate:addDays(cursor,days-1),days,confirmed:Boolean(existing?.confirmed||existing?.sourceUrl),sourceUrl:existing?.sourceUrl||''});
    cursor=addDays(cursor,days);
  }
  return merged;
}
export async function ensureSchoolHijriYear(client,year){
  const months=await loadSchoolHijriYear((...args)=>client.query(...args),year);
  for(const m of months){
    await client.query(`INSERT INTO attendance_hijri_months(hijri_year,hijri_month,start_date,end_date,source_url,confirmed) VALUES($1,$2,$3::date,$4::date,$5,$6) ON CONFLICT(hijri_year,hijri_month) DO NOTHING`,[m.year,m.month,m.startDate,m.endDate,m.sourceUrl,m.confirmed]);
  }
}

// One-time official homepage date correction for 1448 AH:
// 2026-11-12 = 1 Jumada al-Akhira in Najaf (2026-11-13 = day 2).
// A contiguous 29/30-day calendar requires absorbing the extra day in the
// nearest earlier 29-day provisional month. Never overwrite manual corrections.
export const JUMADA_1448_SOURCE = 'https://www.sistani.org/';
export function correctJumada1448(months){
  if(months.length!==12 || months.some((m,i)=>Number(m.year)!==1448 || Number(m.month)!==i+1))throw new Error('Invalid 1448 school calendar');
  const target=months[5];
  if(target.startDate==='2026-11-12')return null; // already corrected
  if(target.startDate!=='2026-11-11')return null; // custom calendar, do not override
  const index=months.slice(0,5).findLastIndex(m=>Number(m.days)===29);
  if(index<0 || months.slice(index).some(m=>m.confirmed || m.sourceUrl))return null;
  const revised=months.map(m=>({...m}));
  revised[index].endDate=addDays(revised[index].endDate,1);
  revised[index].days=30;
  for(let i=index+1;i<revised.length;i++){
    revised[i].startDate=addDays(revised[i].startDate,1);
    revised[i].endDate=addDays(revised[i].endDate,1);
  }
  revised[5].confirmed=true;
  revised[5].sourceUrl=JUMADA_1448_SOURCE;
  if(revised[5].startDate!=='2026-11-12' || revised.some((m,i)=>m.days!==daysBetween(m.startDate,m.endDate)||![29,30].includes(m.days)||(i>0&&m.startDate!==addDays(revised[i-1].endDate,1))))throw new Error('Hijri correction consistency check failed');
  return revised;
}

// Called on deployment; idempotent, and leaves any already-edited school calendar alone.
export async function applyJumada1448Correction(pool){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('LOCK TABLE attendance_hijri_months IN EXCLUSIVE MODE');
    await ensureSchoolHijriYear(client,1448);
    const {rows}=await client.query(`SELECT hijri_year AS year,hijri_month AS month,start_date::text AS "startDate",end_date::text AS "endDate",source_url AS "sourceUrl",confirmed FROM attendance_hijri_months WHERE hijri_year=1448 ORDER BY hijri_month FOR UPDATE`);
    const months=rows.map(r=>({...r,days:daysBetween(r.startDate,r.endDate)}));
    // Don't change any school which already has custom month boundaries.
    const forecast=forecastYear(1448);
    const isSeed=months.length===12&&months.every((m,i)=>m.startDate===forecast[i].startDate&&m.endDate===forecast[i].endDate);
    const corrected=isSeed?correctJumada1448(months):null;
    if(corrected){
      for(let i=0;i<corrected.length;i++){
        const m=corrected[i],previous=months[i];
        if(m.startDate===previous.startDate&&m.endDate===previous.endDate&&m.confirmed===previous.confirmed)continue;
        await client.query(`UPDATE attendance_hijri_months SET start_date=$3::date,end_date=$4::date,source_url=$5,confirmed=$6,updated_at=now() WHERE hijri_year=$1 AND hijri_month=$2`,[1448,m.month,m.startDate,m.endDate,m.sourceUrl,m.confirmed]);
      }
    }
    await client.query('COMMIT');
    return Boolean(corrected);
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

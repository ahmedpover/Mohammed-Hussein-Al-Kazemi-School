import test from 'node:test';
import assert from 'node:assert/strict';
import {forecastYear,reflowMonths,addDays,daysBetween,loadSchoolHijriYear} from '../hijri-calendar.js';

test('all 12 provisional months are present and have 29 or 30 days',()=>{
  for(const y of [1447,1448,1449]){
    const months=forecastYear(y);
    assert.equal(months.length,12);
    months.forEach((m,i)=>{
      assert.equal(m.month,i+1);
      assert.ok([29,30].includes(m.days));
      assert.equal(daysBetween(m.startDate,m.endDate),m.days);
      if(i)assert.equal(m.startDate,addDays(months[i-1].endDate,1));
      assert.equal(m.confirmed,false);
    });
  }
});

test('changing one month length shifts every later month without overlap',()=>{
  const original=forecastYear(1448),index=3;
  const swapped=original[index].days===30?29:30;
  const updated=reflowMonths(original,index,swapped);
  assert.equal(updated.length,12);
  assert.equal(updated[index].days,swapped);
  assert.equal(updated[index].startDate,original[index].startDate);
  assert.equal(updated[index-1].endDate,original[index-1].endDate);
  updated.forEach((m,i)=>{
    if(i)assert.equal(m.startDate,addDays(updated[i-1].endDate,1));
    assert.equal(daysBetween(m.startDate,m.endDate),m.days);
  });
});

test('start-date corrections adjust adjacent month only when it stays 29 or 30 days',()=>{
  const original=forecastYear(1448),index=4;
  const prev=original[index-1];
  const desired=prev.days===29?addDays(original[index].startDate,1):addDays(original[index].startDate,-1);
  const changed=reflowMonths(original,index,original[index].days,desired);
  assert.equal(changed[index-1].days,prev.days===29?30:29);
  assert.equal(changed[index].startDate,desired);
  assert.equal(changed[index].startDate,addDays(changed[index-1].endDate,1));
  assert.throws(()=>reflowMonths(original,index,original[index].days,addDays(original[index].startDate,4)));
});

test('the following year uses corrected previous-year end as global anchor',async()=>{
  const previous=forecastYear(1448),correctedLast=addDays(previous.at(-1).endDate,1);
  const query=async(sql,args)=>({rows:sql.includes('hijri_year=$1 AND hijri_month=12')?[{finish:correctedLast}]:[]});
  const next=await loadSchoolHijriYear(query,1449);
  assert.equal(next[0].startDate,addDays(correctedLast,1));
  assert.equal(next.length,12);
});

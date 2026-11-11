import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAttendanceWorkbook} from '../attendance-xlsx.js';
test('attendance export produces a real OOXML xlsx workbook',async()=>{
 const blob=makeAttendanceWorkbook({month:'2026-11',groups:[{name:'الأولى',students:[{name:'أحمد',absences:1,delays:2,presents:4}]},{name:'الثانية',students:[]}]});
 assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 const data=new Uint8Array(await blob.arrayBuffer());
 assert.equal(String.fromCharCode(...data.slice(0,4)),'PK\x03\x04');
 assert.ok(data.length>3000);
});
test('export rejects empty report',()=>assert.throws(()=>makeAttendanceWorkbook({groups:[]}),/لا توجد شعب/));

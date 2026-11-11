import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAttendanceWorkbook} from '../attendance-xlsx.js';
test('attendance export produces Excel XML workbook with one worksheet per group',async()=>{
 const blob=makeAttendanceWorkbook({month:'2026-11',groups:[{name:'الأولى',students:[{name:'أحمد',absences:1,delays:2,presents:4}]},{name:'الثانية',students:[]}]});
 assert.equal(blob.type,'application/vnd.ms-excel');
 const text=Buffer.from(await blob.arrayBuffer()).toString('utf8');
 assert.ok(text.includes('<?xml version="1.0"'));
 assert.ok(text.includes('<Worksheet ss:Name="الأولى">'));
 assert.ok(text.includes('<Worksheet ss:Name="الثانية">'));
 assert.ok(text.includes('مدرسة الشيخ محمد حسين الكاظمي'));
});
test('export rejects empty report',()=>assert.throws(()=>makeAttendanceWorkbook({groups:[]}),/لا توجد شعب/));

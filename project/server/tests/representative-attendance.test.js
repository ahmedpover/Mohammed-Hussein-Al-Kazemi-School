import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const attendanceUrl=new URL('../attendance.js',import.meta.url);
const policyUrl=new URL('../attendance-policy.js',import.meta.url).href;
const hijriUrl=new URL('../hijri-calendar.js',import.meta.url).href;
let source=await readFile(attendanceUrl,'utf8');
source=source.replace("import express from 'express';",`const express={Router:()=>({routes:{},get(path,fn){this.routes['GET '+path]=fn;},post(path,fn){this.routes['POST '+path]=fn;},put(path,fn){this.routes['PUT '+path]=fn;},patch(path,fn){this.routes['PATCH '+path]=fn;}})};`)
 .replace("from './attendance-policy.js'",`from '${policyUrl}'`)
 .replace("from './hijri-calendar.js'",`from '${hijriUrl}'`);
const {createAttendanceRouter}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const a='3f9eb26b-2cf8-4ee8-b9d8-08245bf9d2b7';
const b='1dca5f10-bca7-4424-8c4e-f1123101dd11';
const user='6ec3f98e-1029-4b7b-9c88-87b8b64ea444';
const lessonId='9e5f937e-afd5-4828-ac65-507ce1a31cea';
const rep={id:user,role:'representative',groupId:a};
function call(router,method,path,actor,{body={},params={},query={}}={}){
 const handler=router.routes[method+' '+path];assert.ok(handler);
 return new Promise((resolve,reject)=>{
  const res={status(n){this.code=n;return this;},json(value){resolve({status:this.code||200,body:value});}};
  handler({actor,body,params,query},res,reject);
 });
}
test('representative is denied admin-only statistics, excused absences and calendar writes',async()=>{
 const router=createAttendanceRouter({query:async()=>{throw new Error('No database should be read');},pool:{},id:()=>lessonId});
 for(const [method,path,params,query,body] of [
  ['GET','/report',{}, {month:'2026-11'}],['GET','/students'],['GET','/students/:studentId',{studentId:user}],
  ['GET','/hijri-months',{}, {year:1448}],['PUT','/hijri-months',{}, {},{year:1448}],
  ['PATCH','/students/:studentId/lessons/:lessonId/excuse',{studentId:user,lessonId}, {},{excused:true}]
 ]) await assert.rejects(()=>call(router,method,path,rep,{params,query,body}),{status:403});
});
test('representative cannot view roster or lessons belonging to another student group',async()=>{
 const router=createAttendanceRouter({query:async()=>{throw new Error('Should reject before database query');},pool:{},id:()=>lessonId});
 await assert.rejects(()=>call(router,'GET','/groups/:groupId/roster',rep,{params:{groupId:b}}),{status:403});
 await assert.rejects(()=>call(router,'GET','/lessons',rep,{query:{groupId:b,date:'2026-11-12'}}),{status:403});
 await assert.rejects(()=>call(router,'POST','/lessons',rep,{body:{groupId:b,lessonDate:'2026-11-12',subject:'الفقه',finalize:true,entries:[{studentId:user,status:'present'}]}}),{status:403});
});
test('representative receives only their designated group',async()=>{
 const queries=[];
 const router=createAttendanceRouter({query:async(sql,args)=>{queries.push({sql,args});return{rows:[{id:a,name:'الأولى',studentCount:3}]};},pool:{},id:()=>lessonId});
 const result=await call(router,'GET','/groups',rep);
 assert.equal(result.status,200);assert.equal(result.body.length,1);
 assert.deepEqual(queries[0].args,[a]);
});
test('representative cannot overwrite an approved attendance record',async()=>{
 const sql=[];
 const pool={connect:async()=>({query:async(statement,args=[])=>{
  sql.push(statement);
  if(statement.includes('SELECT id,name FROM student_groups'))return{rows:[{id:a,name:'الأولى'}]};
  if(statement.includes('SELECT id,period,group_id,finalized FROM attendance_lessons'))return{rows:[{id:lessonId,period:1,group_id:a,finalized:true}]};
  return{rows:[]};
 },release(){}})};
 const router=createAttendanceRouter({query:async()=>({rows:[]}),pool,id:()=>lessonId});
 await assert.rejects(()=>call(router,'POST','/lessons',rep,{body:{groupId:a,lessonId,lessonDate:'2026-11-12',subject:'الفقه',finalize:true,entries:[{studentId:user,status:'present'}]}}),{status:403});
 assert.ok(sql.includes('ROLLBACK'));
 assert.ok(!sql.some(x=>x.includes('UPDATE attendance_lessons')));
});

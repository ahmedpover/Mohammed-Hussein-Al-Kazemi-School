import test from 'node:test';
import assert from 'node:assert/strict';
import {validDate,validMonth,monthRange,validUUID,validateLessonInput,verifyRoster} from '../attendance-policy.js';
const groupId='3f9eb26b-2cf8-4ee8-b9d8-08245bf9d2b7';
const student1='6ec3f98e-1029-4b7b-9c88-87b8b64ea444';
const student2='6ec3f98e-1029-4b7b-9c88-87b8b64ea445';
const lessonId='9e5f937e-afd5-4828-ac65-507ce1a31cea';
const base=()=>({groupId,lessonDate:'2026-11-11',period:2,subject:' الفقه ',entries:[{studentId:student1,status:'present'},{studentId:student2,status:'absent'}],finalize:true});
test('validates calendar dates including leap dates and rejects bogus days',()=>{
 assert.ok(validDate('2028-02-29'));
 for(const item of ['2026-02-29','2026-13-01','2026-04-31','2026-11-1','2026-11-00','not-a-date'])assert.equal(validDate(item),false);
});
test('months are exact and use the first day',()=>{
 assert.ok(validMonth('2026-11')); assert.equal(monthRange('2026-11'),'2026-11-01');
 for(const item of ['2026-00','2026-13','2026-1','2026-11-02'])assert.throws(()=>monthRange(item),{status:400});
});
test('normalizes subjects and allows all three exclusive states',()=>{
 const input=validateLessonInput(base());assert.equal(input.subject,'الفقه');assert.equal(input.period,2);assert.equal(input.entries.length,2);
 for(const status of ['present','late','absent'])assert.equal(validateLessonInput({...base(),entries:[{studentId:student1,status}]}).entries[0].status,status);
});
test('requires an exact immutable roster',()=>{
 assert.equal(verifyRoster([student1,student2],base().entries),true);
 assert.throws(()=>verifyRoster([student1,student2],[{studentId:student1,status:'absent'}]),{status:409});
 assert.throws(()=>verifyRoster([student1],[{studentId:student2,status:'absent'}]),{status:409});
});
test('rejects duplicate students, bad statuses, and empty sets',()=>{
 assert.throws(()=>validateLessonInput({...base(),entries:[]}),{status:400});
 assert.throws(()=>validateLessonInput({...base(),entries:[{studentId:student1,status:'absent'},{studentId:student1,status:'late'}]}),{status:400});
 assert.throws(()=>validateLessonInput({...base(),entries:[{studentId:student1,status:'excused'}]}),{status:400});
});
test('guards the group, period, date, subject, and finalization flag',()=>{
 for(const entry of [{groupId:'x'},{period:0},{period:13},{period:1.5},{lessonDate:'2026-02-30'},{subject:''},{subject:'x'.repeat(101)},{finalize:'yes'}])assert.throws(()=>validateLessonInput({...base(),...entry}),{status:400});
});
test('existing lesson ids are validated to prevent accidental replacement',()=>{
 assert.ok(validUUID(lessonId)); assert.equal(validateLessonInput({...base(),lessonId}).lessonId,lessonId);
 assert.throws(()=>validateLessonInput({...base(),lessonId:'bad'}),{status:400});
});

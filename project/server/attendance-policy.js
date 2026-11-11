// Pure attendance validation helpers, shared with tests.
export const STATUSES = Object.freeze(['present','late','absent']);
export const validUUID = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const validDate = value => {
  if (typeof value !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) return false;
  const date = new Date(value+'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10)===value;
};
export const validMonth = value => typeof value==='string' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(value);
export function validateLessonInput(value) {
  if (!value || !validUUID(value.groupId)) throw Object.assign(new Error('اختر الشعبة أولاً.'),{status:400});
  if (!validDate(value.lessonDate)) throw Object.assign(new Error('اختر تاريخاً صحيحاً.'),{status:400});
  const period = Number(value.period);
  if (!Number.isInteger(period) || period < 1 || period > 12) throw Object.assign(new Error('رقم الحصة يجب أن يكون بين 1 و12.'),{status:400});
  const subject=typeof value.subject==='string'?value.subject.trim():'';
  if (!subject || subject.length>100) throw Object.assign(new Error('اكتب اسم المادة (حتى 100 حرف).'),{status:400});
  if (!Array.isArray(value.entries) || value.entries.length > 500 || value.entries.length === 0) throw Object.assign(new Error('قائمة الطلاب غير صحيحة.'),{status:400});
  const ids=new Set();
  for (const entry of value.entries) {
    if (!validUUID(entry?.studentId) || !STATUSES.includes(entry?.status) || ids.has(entry.studentId)) throw Object.assign(new Error('حالات الطلاب غير صحيحة أو مكررة.'),{status:400});
    ids.add(entry.studentId);
  }
  if (value.finalize !== true && value.finalize !== false) throw Object.assign(new Error('حدد حفظ المسودة أو اعتماد السجل.'),{status:400});
  if(value.lessonId!==undefined && value.lessonId!==null && !validUUID(value.lessonId))throw Object.assign(new Error('معرّف السجل غير صحيح.'),{status:400});
  return {groupId:value.groupId,lessonDate:value.lessonDate,period,subject,entries:value.entries,finalize:value.finalize,lessonId:value.lessonId||null};
}
export function verifyRoster(expectedIds, entries) {
  const expected=new Set(expectedIds);
  if (expected.size!==entries.length || entries.some(item=>!expected.has(item.studentId))) throw Object.assign(new Error('قائمة الطلاب تغيّرت. حدّث الصفحة قبل حفظ السجل.'),{status:409});
  return true;
}
export function monthRange(month) { if(!validMonth(month))throw Object.assign(new Error('الشهر غير صحيح.'),{status:400}); return month+'-01'; }

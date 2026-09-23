import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase.js';

const emailKey = email => email?.trim().toLowerCase();
export const formatDate = value => value?.toDate ? new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'long', year: 'numeric' }).format(value.toDate()) : 'الآن';

export async function identifyUser(user) {
  if (!user?.emailVerified) return null;
  const admin = await getDoc(doc(db, 'admins', user.uid));
  if (admin.exists()) return { role: 'admin', name: admin.data().name || user.displayName || 'إدارة المدرسة', subjects: [] };
  const invite = await getDoc(doc(db, 'teacherInvites', emailKey(user.email)));
  if (invite.exists() && invite.data().active) return { role: 'teacher', name: invite.data().name, subjects: invite.data().subjects || [] };
  return { role: 'student', name: user.displayName || user.email?.split('@')[0] || 'طالب', subjects: [] };
}

export function watchInvites(callback, onError) {
  return onSnapshot(collection(db, 'teacherInvites'), snapshot => callback(snapshot.docs.map(item => ({ email: item.id, ...item.data() }))), onError);
}

export function watchLectures(callback, onError) {
  return onSnapshot(collection(db, 'lectures'), snapshot => callback(snapshot.docs.map(item => ({ id: item.id, ...item.data(), date: formatDate(item.data().createdAt) }))), onError);
}

export function watchChannels(callback, onError) {
  return onSnapshot(collection(db, 'channels'), snapshot => callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))), onError);
}

export function watchJoined(uid, callback, onError) {
  return onSnapshot(query(collection(db, 'memberships'), where('uid', '==', uid)), snapshot => callback(snapshot.docs.map(item => item.data().channelId)), onError);
}

export function watchPosts(channelId, callback, onError) {
  return onSnapshot(collection(db, 'channels', channelId, 'posts'), snapshot => callback(snapshot.docs.map(item => ({ id: item.id, ...item.data(), date: formatDate(item.data().createdAt) })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))), onError);
}

export async function saveInvite({ email, name, subjects, active }) {
  const normalized = emailKey(email);
  if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(normalized)) throw new Error('البريد غير صالح.');
  if (!name.trim() || subjects.length < 1 || subjects.length > 20) throw new Error('اكتب الاسم ومادة واحدة على الأقل.');
  await setDoc(doc(db, 'teacherInvites', normalized), { name: name.trim(), subjects: [...new Set(subjects.map(s => s.trim()).filter(Boolean))], active, updatedAt: serverTimestamp() });
}

export async function createChannel(user, data, teacherName) {
  const handle = data.handle.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z][a-z0-9_]{3,23}$/.test(handle)) throw new Error('المعرّف يبدأ بحرف إنجليزي ويتكون من ٤ إلى ٢٤ حرفًا أو رقمًا أو شرطة سفلية.');
  const channelId = crypto.randomUUID();
  const reservation = doc(db, 'channelHandles', handle);
  const channel = doc(db, 'channels', channelId);
  await runTransaction(db, async transaction => {
    if ((await transaction.get(reservation)).exists()) throw new Error('هذا المعرّف مستخدم لقناة أخرى.');
    transaction.set(channel, { name: data.name.trim(), subject: data.subject.trim(), book: data.book.trim(), description: data.description.trim(), handle, ownerId: user.uid, teacherName, createdAt: serverTimestamp() });
    transaction.set(reservation, { channelId });
  });
  return channelId;
}

export async function removeChannel(channel) {
  const posts = await getDocs(collection(db, 'channels', channel.id, 'posts'));
  for (const post of posts.docs) {
    if (post.data().imagePath && storage) await deleteObject(ref(storage, post.data().imagePath)).catch(() => {});
    await deleteDoc(post.ref);
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, 'channelHandles', channel.handle));
  batch.delete(doc(db, 'channels', channel.id));
  await batch.commit();
}

export function joinChannel(uid, channelId) {
  return setDoc(doc(db, 'memberships', `${uid}_${channelId}`), { uid, channelId, joinedAt: serverTimestamp() });
}
export function leaveChannel(uid, channelId) { return deleteDoc(doc(db, 'memberships', `${uid}_${channelId}`)); }

export async function createPost(user, channelId, { text, image }) {
  const id = crypto.randomUUID();
  let imageUrl = '', imagePath = '';
  if (image) {
    if (!storage) throw new Error('رفع الصور يحتاج تفعيل Firebase Storage وإضافة اسم الحاوية للإعدادات.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size > 5 * 1024 * 1024) throw new Error('الصورة يجب أن تكون JPG أو PNG أو WebP وبحجم أقصاه ٥ ميغابايت.');
    imagePath = `channelImages/${channelId}/${id}`;
    const imageRef = ref(storage, imagePath);
    await uploadBytes(imageRef, image, { contentType: image.type });
    imageUrl = await getDownloadURL(imageRef);
  }
  try {
    await setDoc(doc(db, 'channels', channelId, 'posts', id), { text: text.trim(), imageUrl, imagePath, ownerId: user.uid, createdAt: serverTimestamp() });
  } catch (error) { if (imagePath) await deleteObject(ref(storage, imagePath)).catch(() => {}); throw error; }
}

export async function removePost(channelId, post) {
  await deleteDoc(doc(db, 'channels', channelId, 'posts', post.id));
  if (post.imagePath && storage) await deleteObject(ref(storage, post.imagePath)).catch(() => {});
}

export async function saveLecture(user, payload, current, teacherName) {
  if (payload.audio && (!payload.audio.type.startsWith('audio/') || payload.audio.size > 100 * 1024 * 1024)) throw new Error('التسجيل الصوتي يجب أن يكون بحجم أقصاه ١٠٠ ميغابايت.');
  if (payload.pdf && (payload.pdf.type !== 'application/pdf' || payload.pdf.size > 25 * 1024 * 1024)) throw new Error('ملف PDF يجب أن يكون بحجم أقصاه ٢٥ ميغابايت.');
  if ((payload.audio || payload.pdf) && !storage) throw new Error('رفع الملفات يحتاج تفعيل Firebase Storage وإضافة اسم الحاوية للإعدادات.');
  const id = current?.id || crypto.randomUUID();
  const data = { title: payload.title.trim(), subject: payload.subject.trim(), book: payload.book.trim(), description: payload.description.trim(), ownerId: user.uid, teacherName, createdAt: current?.createdAt || serverTimestamp(), audioUrl: current?.audioUrl || '', pdfUrl: current?.pdfUrl || '' };
  if (current) await updateDoc(doc(db, 'lectures', id), data);
  else await setDoc(doc(db, 'lectures', id), data);
  if (payload.audio || payload.pdf) {
    const attachments = [[payload.audio, 'audio', 'audioUrl'], [payload.pdf, 'pdf', 'pdfUrl']];
    for (const [file, type, field] of attachments) {
      if (!file) continue;
      const fileRef = ref(storage, `lectureMedia/${id}/${type}`);
      await uploadBytes(fileRef, file, { contentType: file.type || (type === 'pdf' ? 'application/pdf' : 'audio/mpeg') });
      await updateDoc(doc(db, 'lectures', id), { [field]: await getDownloadURL(fileRef) });
    }
  }
  return id;
}

export async function removeLecture(lecture) {
  await deleteDoc(doc(db, 'lectures', lecture.id));
  if (storage) for (const type of ['audio', 'pdf']) await deleteObject(ref(storage, `lectureMedia/${lecture.id}/${type}`)).catch(() => {});
}

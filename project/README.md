# مدرسة الشيخ محمد حسين الكاظمي — الإصدار 0.7

موقع عربي للمدرسة بواجهة بيج رسمية. حسابات الطالب والأستاذ والمدير تستخدم Firebase Authentication، والمواد والقنوات والمنشورات والمحاضرات تحفظ في Firestore، والمرفقات في Firebase Storage. المدير يعتمد بريد الأستاذ والمواد المسموح بتدريسها؛ يتحقق Firebase من الصلاحيات بقواعد Firestore وStorage.

**لبدء التفعيل على Railway:** اقرأ [FIREBASE_SETUP_AR.md](FIREBASE_SETUP_AR.md) واتبع خطوات Firebase، متغيرات Railway، وإنشاء أول مدير. لا تعتمد على ملف المعاينة المحلي لتجربة الحسابات الحقيقية.

## التطوير

يتطلب Node.js 20.19 أو أحدث. ضع قيم تطبيق Firebase Web في `.env.local` بعد نسخ `.env.example`، ثم:

```bash
npm ci
npm run dev
```

`npm run build` ينتج `dist/`. عند غياب إعداد Firebase تعرض نسخة HTTP رسالة إعداد واضحة؛ `npm run preview:offline` يعيد إنشاء ملف `index.html` المستقل الذي يعرض واجهة المعاينة القديمة محلياً دون حسابات مشتركة.

قواعد البيانات والملفات محفوظة في `firestore.rules` و`storage.rules`، ولا يكفي نشر الواجهة وحدها. لا تنشر مفاتيح إدارة Firebase أو حساب خدمة في المستودع.

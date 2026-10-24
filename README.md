# CodeLab | كود لاب

## الملفات (8 ملفات فقط)
app/page.js            ← المنصة كلها
app/layout.js
app/globals.css
app/api/ai/route.js    ← الذكاء الاصطناعي + ملفات تثبيت التطبيق
package.json, next.config.js, tailwind.config.js, postcss.config.js

(لا تحتاج مجلد public ولا قاعدة بيانات. احذف app/admin و app/api/db و public إن كانت عندك من النسخ القديمة.)

## النشر على Vercel
1. ارفع المشروع إلى GitHub ثم Import في Vercel.
2. Settings > Environment Variables: أضف GEMINI_API_KEY (مفتاح Gemini المجاني). اختياري: GEMINI_MODEL.
3. Deploy.

بدون المفتاح تعمل المنصة بالذكاء الداخلي. وعند انتهاء الحد المجاني يتحول الذكاء الداخلي تلقائياً لمدة ساعة.

## تثبيت التطبيق على الهاتف
افتح الموقع على Chrome ثم اضغط زر 📲 تثبيت أعلى الصفحة، أو من قائمة المتصفح (⋮) اختر «تثبيت التطبيق».

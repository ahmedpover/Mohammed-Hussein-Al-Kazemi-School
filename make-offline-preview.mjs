import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const output = resolve(process.argv[2] || resolve(projectRoot, '..', 'index.html'));
const photo = await readFile(resolve(projectRoot, 'public/school.jpg'));
const photoPath = `data:image/jpeg;base64,${photo.toString('base64')}`;

const result = await build({
  entryPoints: [resolve(projectRoot, 'src/main.jsx')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  loader: { '.ttf': 'dataurl' },
  external: ['/school.jpg'],
  minify: true,
  write: false,
  outdir: resolve(projectRoot, 'offline-bundle'),
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
});

const js = result.outputFiles.find(file => file.path.endsWith('.js'))?.text;
const css = result.outputFiles.find(file => file.path.endsWith('.css'))?.text;
if (!js || !css) throw new Error('Missing JS or CSS bundle');
const safeCss = css.replaceAll('/school.jpg', photoPath).replaceAll('</style', '<\\/style');
const safeJs = js.replaceAll('</script', '<\\/script');
const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#073747" />
<title>مدرسة الشيخ محمد حسين الكاظمي — معاينة</title>
<style>${safeCss}</style>
</head>
<body><div id="root"></div><script>${safeJs}</script></body>
</html>`;
await writeFile(output, html);
console.log(`Offline preview: ${output}`);

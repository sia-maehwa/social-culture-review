/* Build the distributable, single-file local app from the modular source. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(root, file), value, 'utf8');
function assert(ok, message) { if (!ok) throw new Error(message); }
function safeScript(source) { return source.replace(/<\/script/gi, '<\\/script'); }
function safeStyle(source) { return source.replace(/<\/style/gi, '<\\/style'); }
function getExamSessions() {
  const context = {}; vm.createContext(context);
  vm.runInContext(read('js/exams.js'), context, { filename: 'js/exams.js' });
  const exams = Array.from(context.EXAMS || []);
  assert(exams.length === 15, 'Expected 15 exam sessions; found ' + exams.length + '.');
  const questions = exams.reduce((sum, exam) => sum + (exam.questions || []).length, 0);
  assert(questions === 300, 'Expected 300 exam questions; found ' + questions + '.');
  return exams;
}
function makeImageManifest(exams) {
  const manifest = Object.create(null); let count = 0;
  for (const exam of exams) for (let n = 1; n <= 20; n += 1) {
    const filename = 'q' + String(n).padStart(2, '0') + '.jpg';
    const relative = path.join('assets', 'exams', exam.id, filename);
    const absolute = path.join(root, relative);
    assert(fs.existsSync(absolute), 'Missing exam image: ' + relative);
    const bytes = fs.readFileSync(absolute);
    assert(bytes.length > 1000, 'Exam image is empty or truncated: ' + relative);
    manifest[exam.id + '/' + filename] = 'data:image/jpeg;base64,' + bytes.toString('base64');
    count += 1;
  }
  assert(count === 300, 'Expected 300 exam images; found ' + count + '.');
  return { manifest, count };
}
function inlineStyles(html) {
  const css = safeStyle(read('css/style.css'));
  const localCss = /<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']css\/style\.css["'][^>]*>/i;
  assert(localCss.test(html), 'Could not find css/style.css in app-source.html.');
  html = html.replace(localCss, '<style>\n' + css + '\n</style>');
  assert(!/<link\b[^>]*\bhref=["']css\//i.test(html), 'A local stylesheet reference remains.');
  return html;
}
function inlineScripts(html) {
  let count = 0;
  html = html.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (_whole, src) => {
    assert(!/^https?:\/\//i.test(src), 'Unexpected external script: ' + src);
    const absolute = path.resolve(root, src);
    assert(absolute.startsWith(root + path.sep), 'Script path escapes project: ' + src);
    assert(fs.existsSync(absolute), 'Missing local script: ' + src);
    count += 1;
    return '<!-- Embedded source: ' + src + ' -->\n<script>\n' + safeScript(fs.readFileSync(absolute, 'utf8')) + '\n</script>';
  });
  assert(count === 8, 'Expected 8 application scripts; embedded ' + count + '.');
  assert(!/<script\b[^>]*\bsrc=/i.test(html), 'A script src reference remains in local index.html.');
  return html;
}
function inlineExamImageLookup(html, manifest) {
  const original = /function imgSrc\(examId, n\)\s*\{\s*return\s*'assets\/exams\/'\s*\+\s*examId\s*\+\s*'\/q'\s*\+\s*\(n\s*<\s*10\s*\?\s*'0'\s*\+\s*n\s*:\s*n\)\s*\+\s*'\.jpg';\s*\}/;
  const replacement = "function imgSrc(examId, n) {\n    var key = examId + '/q' + (n < 10 ? '0' + n : n) + '.jpg';\n    return window.__LOCAL_EXAM_IMAGES[key] || '';\n  }";
  assert(original.test(html), 'Could not locate the exam image path function.');
  html = html.replace(original, replacement);
  const imageData = 'window.__LOCAL_EXAM_IMAGES = Object.freeze(' + JSON.stringify(manifest) + ');';
  html = html.replace('</head>', '<script>\n' + safeScript(imageData) + '\n</script>\n</head>');
  assert(!/assets\/exams\//.test(html), 'A runtime exam asset path remains.');
  assert((html.match(/data:image\/jpeg;base64,/g) || []).length === 300, 'Expected exactly 300 embedded JPEGs.');
  return html;
}
function main() {
  let html = read('app-source.html');
  assert(!html.includes('data-pplx-inline-edit'), 'Unexpected editor-injected script in app-source.html.');
  const exams = getExamSessions();
  const imagePack = makeImageManifest(exams);
  html = inlineStyles(html);
  html = inlineScripts(html);
  html = inlineExamImageLookup(html, imagePack.manifest);
  html = html.replace('<title>사회문화 연습장 — 수능 개념 문제 연습</title>', '<title>사회문화 연습장</title>');
  html = html.replace('<meta name="description"', '<meta name="local-bundle" content="self-contained-css-js-and-300-exam-images" />\n<meta name="description"');
  assert(!/<(?:script|link)\b[^>]*\b(?:src|href)=["'](?:css|js|assets)\//i.test(html), 'A local external runtime reference remains.');
  write('index.html', html);
  console.log('Built index.html: ' + (Buffer.byteLength(html, 'utf8') / 1024 / 1024).toFixed(2) + ' MiB');
  console.log('Embedded ' + imagePack.count + ' exam images from ' + exams.length + ' sessions.');
}
main();

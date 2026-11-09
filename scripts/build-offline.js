/* Build a self-contained single-file offline version of the study app. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const outputDir = path.join(root, 'offline');
const outputFile = path.join(outputDir, 'index.html');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function safeScript(source) {
  return source.replace(/<\/script/gi, '<\\/script');
}
function safeStyle(source) {
  return source.replace(/<\/style/gi, '<\\/style');
}
function getExamSessions() {
  const context = {};
  vm.createContext(context);
  for (const file of ['js/data.js', 'js/exams.js', 'js/predict.js']) {
    vm.runInContext(read(file), context, { filename: file });
  }
  const exams = Array.from(vm.runInContext('EXAMS', context));
  const predict = Array.from(vm.runInContext('PREDICT_EXAMS', context));
  assert(exams.length === 15, 'Expected 15 official sessions, found ' + exams.length);
  assert(predict.length === 3, 'Expected 3 self-made sessions, found ' + predict.length);
  const questions = exams.reduce((sum, exam) => sum + exam.questions.length, 0);
  assert(questions === 300, 'Expected 300 official questions, found ' + questions);
  return exams;
}
function makeImageManifest(exams) {
  const manifest = Object.create(null);
  let count = 0;
  for (const exam of exams) {
    for (let n = 1; n <= 20; n += 1) {
      const filename = 'q' + String(n).padStart(2, '0') + '.jpg';
      const relative = path.join('assets', 'exams', exam.id, filename);
      const absolute = path.join(root, relative);
      assert(fs.existsSync(absolute), 'Missing official exam image: ' + relative);
      const bytes = fs.readFileSync(absolute);
      assert(bytes.length > 1000, 'Exam image appears empty or truncated: ' + relative);
      manifest[exam.id + '/' + filename] = 'data:image/jpeg;base64,' + bytes.toString('base64');
      count += 1;
    }
  }
  assert(count === 300, 'Expected 300 embedded images, found ' + count);
  return { manifest, count };
}
function inlineStyles(html) {
  const css = safeStyle(read('css/style.css'));
  const localCss = /<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']css\/style\.css["'][^>]*>/i;
  assert(localCss.test(html), 'Could not find css/style.css in index.html');
  html = html.replace(localCss, '<style>\n' + css + '\n</style>');
  html = html.replace(/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']https?:\/\/[^"']+["'][^>]*>\s*/gi, '');
  assert(!/<link\b[^>]*\bhref=["'](?:css|js|assets)\//i.test(html), 'A local stylesheet or asset link remains.');
  return html;
}
function inlineScripts(html, imageManifest) {
  let count = 0;
  html = html.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (_whole, src) => {
    assert(!/^https?:\/\//i.test(src), 'External script is not allowed in offline build: ' + src);
    const file = path.resolve(root, src);
    assert(file.startsWith(root + path.sep), 'Script path escapes repository: ' + src);
    assert(fs.existsSync(file), 'Missing local script: ' + src);
    count += 1;
    return '<!-- Inlined source: ' + src + ' -->\n<script>\n' +
      safeScript(fs.readFileSync(file, 'utf8')) + '\n</script>';
  });
  assert(count >= 8, 'Expected all local application scripts to be inlined, found ' + count);

  const imageData = 'window.__OFFLINE_EXAM_IMAGES = Object.freeze(' + JSON.stringify(imageManifest) + ');';
  const oldLookup = /function imgSrc\(examId, n\)\s*\{\s*return\s*'assets\/exams\/'\s*\+\s*examId\s*\+\s*'\/q'\s*\+\s*\(n\s*<\s*10\s*\?\s*'0'\s*\+\s*n\s*:\s*n\)\s*\+\s*'\.jpg';\s*\}/;
  const replacement = "function imgSrc(examId, n) {\n    var key = examId + '/q' + (n < 10 ? '0' + n : n) + '.jpg';\n    return window.__OFFLINE_EXAM_IMAGES[key] || '';\n  }";
  assert(oldLookup.test(html), 'Could not replace the exam image path with an embedded-image lookup.');
  html = html.replace(oldLookup, replacement);
  html = html.replace('</head>', '<script>\n' + imageData + '\n</script>\n</head>');
  assert(!/<script\b[^>]*\bsrc=/i.test(html), 'An external or local script src remains in the offline HTML.');
  assert(!/assets\/exams\//.test(html), 'A runtime assets/exams path remains in the offline HTML.');
  return html;
}
function main() {
  const exams = getExamSessions();
  const imagePack = makeImageManifest(exams);
  let html = read('index.html');
  assert(!html.includes('data-pplx-inline-edit'), 'Remove editor-injected scripts before offline build.');
  html = inlineStyles(html);
  html = inlineScripts(html, imagePack.manifest);
  html = html.replace('<title>학습 연습장 — 과목별 문제 풀이</title>',
    '<title>학습 연습장 — 오프라인 단일 파일</title>');
  html = html.replace('<meta name="description"',
    '<meta name="offline-bundle" content="self-contained-css-js-and-300-exam-images" />\n<meta name="description"');
  assert(!/<link\b[^>]*\bhref=["'](?:https?:)?\/\//i.test(html), 'An external link resource remains in the offline HTML.');
  assert(!/<(?:script|link)\b[^>]*\b(?:src|href)=["'](?:css|js|assets)\//i.test(html), 'A relative code or asset reference remains in the offline HTML.');
  assert((html.match(/data:image\/jpeg;base64,/g) || []).length === 300,
    'The output does not contain exactly 300 embedded JPEGs.');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, html, 'utf8');
  const bytes = fs.statSync(outputFile).size;
  console.log('Built offline/index.html (' + (bytes / 1024 / 1024).toFixed(2) + ' MiB)');
  console.log('Embedded ' + imagePack.count + ' official exam images across ' + exams.length + ' sessions.');
  console.log('Inline scripts: ' + ((html.match(/<script>/g) || []).length) + '; external runtime files: 0.');
}
main();

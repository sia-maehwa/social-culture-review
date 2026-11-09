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
function validateQuestionData() {
  const context = {}; vm.createContext(context);
  vm.runInContext(read('js/data.js'), context, { filename: 'js/data.js' });
  vm.runInContext(read('js/exams.js'), context, { filename: 'js/exams.js' });
  vm.runInContext(read('js/predict.js'), context, { filename: 'js/predict.js' });
  const base = vm.runInContext('({ units: UNITS, questions: QUESTIONS, concepts: CONCEPTS })', context);
  assert(base.units.length === 5, 'Expected 5 units; found ' + base.units.length + '.');
  assert(base.questions.length === 62, 'Expected 62 concept questions; found ' + base.questions.length + '.');
  assert(Object.keys(base.concepts).length === 5, 'Expected concepts for 5 units.');
  const unitIds = new Set(base.units.map(unit => unit.id));
  for (const q of base.questions) {
    assert(unitIds.has(q.u), 'Concept question ' + q.id + ' refers to missing unit ' + q.u + '.');
    assert(typeof q.q === 'string' && q.q.length > 0, 'Question ' + q.id + ' has no prompt.');
    assert(Array.isArray(q.c) && q.c.length === 5, 'Question ' + q.id + ' does not have five choices.');
    assert(Number.isInteger(q.a) && q.a >= 0 && q.a <= 4, 'Question ' + q.id + ' has an invalid answer index.');
    assert(typeof q.e === 'string' && q.e.length > 0, 'Question ' + q.id + ' has no explanation.');
  }
  const exams = Array.from(vm.runInContext('EXAMS', context));
  assert(exams.length === 15, 'Expected 15 official exam sessions; found ' + exams.length + '.');
  assert(exams.reduce((sum, exam) => sum + exam.questions.length, 0) === 300, 'Expected 300 official exam answer records.');
  for (const exam of exams) {
    assert(exam.questions.length === 20, 'Exam ' + exam.id + ' does not contain 20 questions.');
    for (let i = 0; i < exam.questions.length; i += 1) {
      const q = exam.questions[i];
      assert(q.n === i + 1, 'Exam ' + exam.id + ' has an out-of-order question number.');
      assert(Number.isInteger(q.ans) && q.ans >= 0 && q.ans <= 4, 'Exam ' + exam.id + ' question ' + q.n + ' has an invalid answer.');
      assert(q.pts === 2 || q.pts === 3, 'Exam ' + exam.id + ' question ' + q.n + ' has an invalid point value.');
    }
  }
  const predict = Array.from(vm.runInContext('PREDICT_EXAMS', context));
  assert(predict.length === 3, 'Expected 3 self-made mock exams; found ' + predict.length + '.');
  assert(predict.reduce((sum, exam) => sum + exam.questions.length, 0) === 60, 'Expected 60 self-made mock questions.');
  for (const exam of predict) for (const q of exam.questions) {
    assert(Array.isArray(q.c) && q.c.length === 5, 'Predict exam ' + exam.id + ' question ' + q.n + ' does not have five choices.');
    assert(Number.isInteger(q.a) && q.a >= 0 && q.a <= 4, 'Predict exam ' + exam.id + ' question ' + q.n + ' has an invalid answer.');
    assert(typeof q.e === 'string' && q.e.length > 0, 'Predict exam ' + exam.id + ' question ' + q.n + ' has no explanation.');
  }
  return { exams, conceptQuestions: base.questions.length, predictQuestions: predict.reduce((sum, exam) => sum + exam.questions.length, 0) };
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
    assert(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9, 'Exam image is not a complete JPEG: ' + relative);
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
  const nomedia = path.join(root, 'assets', '.nomedia');
  assert(fs.existsSync(nomedia) && fs.statSync(nomedia).size === 0, 'Missing empty assets/.nomedia; Android Gallery may index the exam JPG files.');
  let html = read('app-source.html');
  assert(!html.includes('data-pplx-inline-edit'), 'Unexpected editor-injected script in app-source.html.');
  assert(html.includes('id="view-subject-select"'), 'The first-visit subject selection view is missing.');
  const dataCheck = validateQuestionData();
  const exams = dataCheck.exams;
  const imagePack = makeImageManifest(exams);
  html = inlineStyles(html);
  html = inlineScripts(html);
  html = inlineExamImageLookup(html, imagePack.manifest);
  html = html.replace('<title>사회문화 연습장 — 수능 개념 문제 연습</title>', '<title>사회문화 연습장</title>');
  html = html.replace('<meta name="description"', '<meta name="local-bundle" content="self-contained-css-js-and-300-exam-images" />\n<meta name="description"');
  assert(!/<(?:script|link)\b[^>]*\b(?:src|href)=["'](?:css|js|assets)\//i.test(html), 'A local external runtime reference remains.');
  assert(!/<link\b[^>]*\bhref=["']https?:\/\//i.test(html), 'The local HTML still depends on an external stylesheet.');
  write('index.html', html);
  console.log('Built index.html: ' + (Buffer.byteLength(html, 'utf8') / 1024 / 1024).toFixed(2) + ' MiB');
  console.log('Validated 5 units, ' + dataCheck.conceptQuestions + ' concept questions, ' + exams.length + ' official sessions / 300 answer records, and ' + dataCheck.predictQuestions + ' self-made questions.');
  console.log('Embedded ' + imagePack.count + ' exam images from ' + exams.length + ' sessions.');
}
main();

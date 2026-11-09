/* Build a lightweight shared entrypoint for GitHub Pages and extracted local ZIP use.
 * Runtime assets stay as ordinary sibling files; drawing never uses network APIs. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(root, file), value, 'utf8');
function assert(ok, message) { if (!ok) throw new Error(message); }

function validateQuestionData() {
  const context = {};
  vm.createContext(context);
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

function validateRuntimeAssets(exams) {
  const cssPath = path.join(root, 'css/style.css');
  assert(fs.existsSync(cssPath), 'Missing css/style.css.');
  assert(fs.statSync(cssPath).size > 1000, 'css/style.css is unexpectedly small.');

  const requiredScripts = [
    'js/data.js', 'js/exams.js', 'js/storage.js', 'js/predict.js',
    'js/game.js', 'js/pen-tools.js', 'js/exam-app.js', 'js/app.js'
  ];
  for (const file of requiredScripts) {
    const absolute = path.join(root, file);
    assert(fs.existsSync(absolute), 'Missing runtime script: ' + file);
    assert(fs.statSync(absolute).size > 100, 'Runtime script is unexpectedly small: ' + file);
  }

  let count = 0;
  let bytes = 0;
  for (const exam of exams) for (let n = 1; n <= 20; n += 1) {
    const filename = 'q' + String(n).padStart(2, '0') + '.jpg';
    const relative = path.join('assets', 'exams', exam.id, filename);
    const absolute = path.join(root, relative);
    assert(fs.existsSync(absolute), 'Missing exam image: ' + relative);
    const stat = fs.statSync(absolute);
    assert(stat.size > 1000, 'Exam image is empty or truncated: ' + relative);
    const fd = fs.openSync(absolute, 'r');
    const head = Buffer.alloc(2);
    const tail = Buffer.alloc(2);
    try {
      fs.readSync(fd, head, 0, 2, 0);
      fs.readSync(fd, tail, 0, 2, stat.size - 2);
    } finally {
      fs.closeSync(fd);
    }
    assert(head[0] === 0xff && head[1] === 0xd8 && tail[0] === 0xff && tail[1] === 0xd9,
      'Exam image is not a complete JPEG: ' + relative);
    bytes += stat.size;
    count += 1;
  }
  assert(count === 300, 'Expected 300 exam images; found ' + count + '.');
  return { count, bytes };
}

function main() {
  const nomedia = path.join(root, 'assets', '.nomedia');
  assert(fs.existsSync(nomedia) && fs.statSync(nomedia).size === 0,
    'Missing empty assets/.nomedia; Android Gallery may index the exam JPG files.');

  let html = read('app-source.html');
  const examApp = read('js/exam-app.js');
  assert(!html.includes('data-pplx-inline-edit'), 'Unexpected editor-injected script in app-source.html.');
  assert(html.includes('id="view-subject-select"'), 'The first-visit subject selection view is missing.');

  const dataCheck = validateQuestionData();
  const assetCheck = validateRuntimeAssets(dataCheck.exams);

  assert(/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']css\/style\.css["'][^>]*>/i.test(html),
    'The source template must load the local css/style.css file.');
  for (const file of ['js/data.js', 'js/exams.js', 'js/storage.js', 'js/predict.js', 'js/game.js', 'js/pen-tools.js', 'js/exam-app.js', 'js/app.js']) {
    assert(html.includes('src="' + file + '"'), 'The source template is missing ' + file + '.');
  }
  assert(examApp.includes("return 'assets/exams/'"),
    'The exam renderer must use ordinary relative exam-image paths.');
  assert(!/https?:\/\//i.test(html.replace(/<link rel="icon" href="data:image\/svg\+xml,[^"]*"/, '')),
    'The runtime template must not depend on an external URL.');

  html = html.replace('<title>사회문화 연습장 — 수능 개념 문제 연습</title>', '<title>사회문화 연습장</title>');
  html = html.replace('<meta name="description"', '<meta name="app-runtime" content="local-static-files-no-network-api" />\n<meta name="description"');
  assert(Buffer.byteLength(html, 'utf8') < 100000, 'The shared entrypoint must stay below 100 KB.');
  write('index.html', html);

  console.log('Built lightweight index.html: ' + (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1) + ' KiB.');
  console.log('Validated 5 units, ' + dataCheck.conceptQuestions + ' concept questions, ' +
    dataCheck.exams.length + ' official sessions / 300 answer records, and ' + dataCheck.predictQuestions + ' self-made questions.');
  console.log('Validated ' + assetCheck.count + ' JPEG files (' + (assetCheck.bytes / 1024 / 1024).toFixed(2) + ' MiB total) without embedding them into HTML.');
  console.log('Runtime uses local relative CSS/JS/image files; pen drawing and storage remain device-local.');
}

main();

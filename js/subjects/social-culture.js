/* 사회·문화 과목 데이터 등록 */
(function () {
  'use strict';
  window.SubjectRegistry.register({
    id: 'social-culture',
    storagePrefix: 'socmul',
    title: '사회·문화',
    curriculumLabel: '2015 개정 교육과정',
    description: '사회·문화 핵심 개념을 단원별 문제와 해설로 학습합니다.',
    units: window.UNITS,
    questions: window.QUESTIONS,
    concepts: window.CONCEPTS,
    exams: window.EXAMS || [],
    predictExams: window.PREDICT_EXAMS || [],
    features: { exams: true, game: true }
  });
})();

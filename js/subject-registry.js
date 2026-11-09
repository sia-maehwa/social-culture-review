/* 과목 등록부: 과목 데이터와 학습 엔진을 분리합니다. */
(function () {
  'use strict';
  var subjects = Object.create(null), activeId = null;
  var ACTIVE_KEY = 'study_active_subject_v1';
  function register(subject) {
    if (!subject || !/^[a-z0-9-]+$/.test(subject.id || '')) throw new Error('Invalid subject id');
    if (!Array.isArray(subject.units) || !Array.isArray(subject.questions) || !subject.concepts) {
      throw new Error('Subject requires units, questions and concepts');
    }
    subjects[subject.id] = subject;
    return subject;
  }
  function activate(id) {
    var subject = subjects[id];
    if (!subject) return false;
    activeId = id;
    window.UNITS = subject.units;
    window.QUESTIONS = subject.questions;
    window.CONCEPTS = subject.concepts;
    window.EXAMS = Array.isArray(subject.exams) ? subject.exams : [];
    window.PREDICT_EXAMS = Array.isArray(subject.predictExams) ? subject.predictExams : [];
    try { window.localStorage.setItem(ACTIVE_KEY, id); } catch (ignore) {}
    document.dispatchEvent(new CustomEvent('subjectchange', { detail: { id: id, subject: subject } }));
    return true;
  }
  function init() {
    var requested = null;
    try { requested = window.localStorage.getItem(ACTIVE_KEY); } catch (ignore) {}
    if (!requested || !subjects[requested]) requested = Object.keys(subjects)[0];
    return activate(requested);
  }
  function current() { return activeId ? subjects[activeId] : null; }
  function list() { return Object.keys(subjects).map(function (id) { return subjects[id]; }); }
  window.SubjectRegistry = { register: register, activate: activate, init: init, current: current, list: list };
})();

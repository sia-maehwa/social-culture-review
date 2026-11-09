# 과목 데이터 등록

새 과목은 JavaScript 데이터 모듈로 등록합니다.

- units: { id, name, desc } 객체 배열
- questions: { id, u, t, d, q, c, a, e } 객체 배열
- concepts: 단원 ID별 { t, d } 개념 배열

새 모듈에서 window.SubjectRegistry.register({...})를 호출합니다. 예시는 js/subjects/social-culture.js를 참고하세요.

새 과목 데이터를 추가한 뒤 index.html에서 registry 초기화보다 먼저 과목 모듈을 불러옵니다. 문제·개념 데이터의 정확성 검증은 과목별 출처 및 교육과정 기준으로 별도 수행해야 합니다.

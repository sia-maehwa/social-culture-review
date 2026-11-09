# 학습 연습장

과목별 단원 학습, 문제 풀이, 오답 노트, 개념 정리와 스타일러스 필기를 제공하는 정적 웹앱입니다. 현재 등록된 과목은 사회·문화입니다.

## 기능

- 단원별 문제, 선택지 채점, 상세 해설, 오답 노트, 단원별 통계
- 사회·문화 자체 제작 예상 모의고사 3회분
- 스타일러스 전용 필기, 문항별 저장·복원, 실행 취소·다시 실행, 지우개
- 빨강·파랑·검정·초록·보라·주황 6가지 펜 색상
- 넓은 필기 영역, 영역 확대, 브라우저 전체화면 집중 모드
- 과목별 저장 공간 분리

## 과목 추가

새 과목의 units, questions, concepts 데이터를 준비하고 js/subjects/ 아래에 과목 모듈을 만듭니다. SubjectRegistry.register({...})로 고유 id, storagePrefix, title, units, questions, concepts, features를 등록합니다. 예시는 js/subjects/social-culture.js를 참고하세요. 새 모듈은 index.html에서 subject-registry.js 뒤, SubjectRegistry.init() 호출 전에 불러옵니다. 시험·게임 기능이 없는 과목은 exams: [], predictExams: [], features: { exams: false, game: false }로 설정합니다.

과목별 기록은 storagePrefix를 기준으로 분리됩니다. 기존 사회·문화 저장 키(socmul_*)는 유지되어 기존 학습 기록과 필기가 계속 사용됩니다.

## 스타일러스와 스크롤

- 브라우저가 PointerEvent.pointerType을 pen으로 전달한 입력만 필기로 저장합니다.
- 펜/지우개 모드에서는 캔버스에 touch-action: none을 적용해 브라우저 세로 패닝이 필기 중 포인터를 취소하는 현상을 줄입니다.
- 이 설정에서는 캔버스 위 손가락 스크롤도 차단됩니다. 스크롤할 때는 필기 끄기를 누르거나 캔버스 바깥에서 스크롤하세요.
- 전체화면은 지원 브라우저에서 Fullscreen API를 사용하고, 실패하면 화면 고정 집중 모드로 대체합니다. 전체화면도 Android OS의 가장자리 시스템 제스처까지 차단하지는 못합니다.
- 일반 정전식 터치펜은 브라우저에서 touch로 보고될 수 있어 펜 입력으로 인식되지 않을 수 있습니다.

## 배포

GitHub Pages에서 main 브랜치의 저장소 루트를 게시합니다. index.html, css/, js/, subjects/를 저장소 최상위에 둡니다.

## 브랜치 보호

.github/CODEOWNERS로 코드 소유자를 지정하고 .github/workflows/quality-check.yml이 PR 및 main push 때 JavaScript 구문과 로컬 파일 참조를 검사합니다. 저장소 Settings → Rules → Rulesets에서 main 대상 활성 Ruleset을 만들고 PR 필수, Required status check "quality-check / validate", Force push 및 브랜치 삭제 차단을 켜야 직접 push를 제한할 수 있습니다. 단독 관리자 저장소에서는 승인 1회나 Code Owner 검토를 필수로 하면 본인 PR을 병합하지 못할 수 있으므로, 독립 검토자를 추가한 뒤 활성화하세요.

현재 연결 도구는 GitHub Ruleset 생성·활성화 기능을 제공하지 않아 관리자 화면에서 마지막 설정을 적용해야 합니다.

## 저작권

이 저장소는 오픈소스 라이선스를 부여하지 않습니다. 원본 프로젝트 코드와 자체 제작 문항은 별도 허락 없이 복제·재배포·2차 이용할 수 없습니다. 제3자 자료는 각 권리자의 조건을 따릅니다.

한국교육과정평가원 기출 이미지 300개는 온라인 재게시 이용허락을 확인하지 못해 현재 게시 트리와 사이트에서 제외했습니다. ASSET_RIGHTS.md를 확인하세요. 삭제 커밋만으로 이전 공개 Git commit 이력의 이미지까지 사라지지는 않습니다. 과거 이력까지 완전 제거하려면 저장소 이력 재작성과 강제 갱신이 필요합니다. 기존 링크와 Fork에 영향을 줄 수 있어 승인 없이 이력 재작성은 하지 않았습니다.

# 학습 연습장

사회·문화 수능 대비용 로컬 학습 웹앱입니다. 이 저장소는 개인 학습용 비공개 저장소로 운영합니다.

## 포함 자료

- 사회·문화 개념 문제 62문항, 5개 단원
- 한국교육과정평가원 기출 15회분(2022~2026학년도 6월·9월·수능), 총 300문항 이미지
- 자체 제작 예상 모의고사 3회분
- 오답 노트, 단원별 학습 통계, 개념 정리, 지식의 탑
- 스타일러스 전용 필기, 문항별 저장·복원, 실행 취소·다시 실행, 지우개
- 빨강·파랑·검정·초록·보라·주황 6가지 펜 색상
- 넓은 필기 영역, 영역 확대, 전체화면 집중 모드

## Android 태블릿에서 파일 하나로 실행

최신 버전 동기화:

```bash
cd ~/storage/shared/study-app
git pull --ff-only origin main
```

파일 관리자에서 **`study-app/offline/index.html`**을 Chrome으로 열면 됩니다. 실행용 HTML에는 CSS, JavaScript, 평가원 기출 이미지 300장이 모두 내장되어 있으므로 Python 서버나 인터넷 연결이 필요하지 않습니다.

개발 원본(`index.html`, `css/`, `js/`, `assets/`)은 기능별 파일로 유지합니다. `scripts/build-offline.js`가 단일 HTML을 생성하며, GitHub Actions가 main 변경 시 `offline/index.html`을 자동으로 다시 빌드해 커밋합니다. 따라서 개발 소스를 수정해 push하면 실행용 HTML도 함께 갱신됩니다.

## 개발 원본 실행이 필요한 경우

개발용 원본은 여러 파일을 상대 경로로 불러오므로 Android Chrome의 `file://`보다 Termux 로컬 서버가 적합합니다.

```bash
cd ~/storage/shared/study-app
python -m http.server 8000 --bind 127.0.0.1
```

Chrome에서 `http://127.0.0.1:8000/`을 엽니다. 서버는 태블릿 내부에서만 접속됩니다.

## 과목 구조

과목 데이터는 `js/subjects/`에 등록합니다. `SubjectRegistry.register({...})`에 고유 `id`, `storagePrefix`, `title`, `units`, `questions`, `concepts`를 전달합니다. 과목별 저장 키는 `storagePrefix`를 기준으로 분리됩니다.

## 스타일러스와 스크롤

- 브라우저가 `PointerEvent.pointerType === 'pen'`으로 전달한 입력만 필기로 저장합니다.
- 펜/지우개 모드에서는 필기 중 페이지 패닝을 잠급니다. 스크롤할 때는 필기를 끄거나 캔버스 바깥을 사용합니다.
- `pointercancel` 또는 포인터 캡처 상실로 취소된 획은 저장하지 않습니다.
- 전체화면은 지원 브라우저에서 Fullscreen API를 사용하고, 실패하면 화면 고정 집중 모드로 대체합니다.
- 일반 정전식 터치펜은 브라우저에서 `touch`로 보고될 수 있어 스타일러스 필기로 인식되지 않을 수 있습니다.

## 자료 취급

평가원 기출 이미지와 회차 데이터는 개인 학습을 위한 비공개 저장소에만 둡니다. 저장소 공개 전환, GitHub Pages 게시, 외부 재배포는 하지 않습니다. 상세한 제3자 자료 주의사항은 [ASSET_RIGHTS.md](ASSET_RIGHTS.md)를 참고하세요.

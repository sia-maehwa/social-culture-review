# 기여 및 변경 관리

1. main에 직접 작업하지 말고 기능 브랜치를 만듭니다.
2. 변경 후 JavaScript 구문 및 로컬 파일 참조 검사를 통과시킵니다.
3. Pull Request에 변경 이유, 영향받는 과목, 시험·필기 동작을 기록합니다.
4. Code Owner 검토 후 병합합니다.
5. 공개 배포는 main에 병합된 변경만 대상으로 합니다.

## 저장소 관리자 설정

GitHub Settings → Rules → Rulesets에서 main 브랜치에 적용되는 활성 Ruleset을 만들고 다음을 켭니다.

- Require a pull request before merging
- Required approvals: 1
- Require review from Code Owners
- Required status check: quality-check / validate
- Block force pushes
- Restrict deletions

.github/CODEOWNERS와 CI 워크플로는 이 설정의 기반입니다. Ruleset 자체는 저장소 소유자가 GitHub 설정 화면에서 활성화해야 합니다.

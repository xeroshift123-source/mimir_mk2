# 기존 Firebase + Netlify 연결

## 현재 연결

- 기본 백엔드: Firebase JS SDK 12.6.0, 기존 `nikke-mimir` 웹 앱, Firestore **`mimirdb`**. 기본 `(default)` DB를 사용하지 않는다.
- 웹 호스팅 설정: 프로젝트 루트 `netlify.toml`, 빌드 `npm run build`, 산출물 `dist/`, Node 22. Firebase 클라이언트 설정은 공개 웹 앱 식별자이며 서비스 계정 키를 포함하지 않는다.
- 로컬: `npm ci`, `npm run dev`, **http://localhost:5173**. `127.0.0.1`은 Firebase 인증 허용 도메인이 아니므로 Google 로그인에는 사용하지 않는다.
- 기존 허용 도메인: localhost, nikke-mimir.firebaseapp.com, nikke-mimir.web.app, nikkemimir.xyz, mimir-nikke.netlify.app. 새로운 미리보기 도메인은 별도 인증 허용 설정이 필요하다.
- 이번 작업은 클라이언트 연결과 로컬 검증이다. 기존 Netlify 운영 배포·DNS·Firebase 규칙과 기존 Cloud Functions는 변경하지 않았다. 평균 조회용 getMimirScoreComparisons는 별도 코드베이스로 추가 배포했다.

## 재사용하는 데이터와 기능

| 마크2 기능 | 기존 저장소 또는 함수 |
|---|---|
| Google 로그인/세션 | 기존 Firebase Authentication 웹 앱, 사용자 브라우저의 인증 지속성 |
| 닉네임·사진·연결 지휘관 | `users/{uid}`, `linkedOpenIds`, 이전 단일 `openId`, `selectedOpenId` |
| 니케·장비·스킬·연구실·수집 품질 | `commanders/{openId}` 저장 스냅샷 |
| 저장 스코어·속성 순위 | 기존 `getNikkeScores` 함수. 조회 시 계산 요청을 보내지 않음 |
| 실제 육성 통계 | 기존 `getNikkeStatistics` 함수, 계정·니케별 1분 요청 캐시 |
| 기존 획득/전시 뱃지 | 사용자 문서의 `badgeUnlocks`, `displayedBadgeIds`; 변경은 `updateDisplayedBadges`, 최대 4개 |
| 공개 작성자 뱃지 | `getPublicBadgeShowcase`, 상세를 펼칠 때만 조회 |
| 계정 연결·갱신 | `scrapeNikkeProfile`, Firebase ID 토큰. 기존 확인 문구 `미미르만만세`와 갱신 쿨다운 유지 |
| 탈퇴 | 재인증 후 기존 `deleteMimirAccount`. 이 작업의 검증에서는 실행하지 않음 |
| 공유 덱 조회·게시·수정 | `shared_decks` 원본 문서·작성자 UID와 스쿼드별 `nikkeIds` 맵 구조 유지 |
| 공유 덱 추천·삭제 | 기존 `voteSharedDeck`, `deleteSharedDeck`. 이 작업의 검증에서는 쓰기 실행하지 않음 |

기존 덱 ID와 작성자·추천 수·날짜·설명·시즌을 변환 없이 재사용한다. 새 덱 게시 시 작성자는 Firebase 로그인 UID로 지정하며, 기존 작성자만 수정할 수 있다. 설명은 기존 보안 규칙에 맞춰 1,200자까지 지원한다. 계정 연결 필드는 클라이언트에서 생성하지 않고 기존 서버 검증을 사용한다.

구형 스냅샷의 수집 품질 표시와 누락값을 보존한다. 불완전한 육성이나 통계 누락을 완성된 값으로 만들지 않는다. 스코어 조회가 실패해도 저장된 육성 정보는 표시하고 스코어 탭에 오류를 안내한다. 원본 스냅샷의 추가 필드(코스튬 등)는 변환 과정에서 보존하지만 모든 필드를 화면에 새로 표시한 것은 아니다.

## 조회 비용과 캐시

공유 덱은 40개 단위 커서 조회를 캐시하고 화면에 20개씩 제공한다. 시즌·포함·제외 필터는 이미 읽은 페이지를 재사용한다. 기존 DB에 복합 인덱스를 강제로 추가하지 않는다. 최신순은 필요한 페이지까지만 읽는다. 추천순은 `upvotes` 내림차순으로 읽고, 미조회 덱의 가능한 최대 순점수보다 현재 페이지의 기준점수가 높아지면 멈춘다. 추천이 비슷하거나 희소 필터인 경우 더 많은 페이지를 읽을 수 있다. 캐시는 1분이며 쓰기 후 무효화한다. 추천 수의 권한과 동시성은 기존 서버 트랜잭션이 처리한다.

## 검증 (2026-11-12)

- `npm run build`, `npm test`, `npm run check:server` 통과.
- `tests/firebase-mapping.test.ts`: 단일/다중 연동 문서, 품질·코스튬·정책 보존, 스쿼드 맵 호환성, 서버 입력 제한, 뱃지 전시 제한 테스트.
- `npm run test:firebase:live`: **읽기 전용** 실서비스 검사. 공개 덱 15개, 니케 ID 누락 0개, 최신순·추천순·시즌 필터 정상. 비로그인 개인 문서 읽기와 스코어 함수 호출이 거부됨을 확인.
- 사용자가 localhost의 앱 내 브라우저에서 실제 Google 로그인을 완료. 기존 연동 지휘관과 획득·전시 뱃지, 보유 니케 189명, 장비·스킬·연구실·저장 스코어·속성 순위를 화면에서 확인.
- 실제 육성 통계 조회: 라피 레드 후드 표본 2,186명, 오버로드·스킬 조합·장비 강화 통계 표시 확인.
- 개인정보나 토큰을 검증 보고서에 저장하지 않는다. 실데이터 쓰기·삭제·재수집은 검증용으로 실행하지 않았다.
- npm 의존성 감사 0건. Firebase의 Node 전용 전이 의존성 `@grpc/grpc-js`는 수정 버전 `^1.13.6`으로 고정 범위를 재정의했다.

## 남은 범위

- 마크2에서 추가한 월드컵 우승 뱃지는 기존 Firebase 함수에 대응 API가 없다. 브라우저 결과·이미지 기능은 유지하며 서버 저장은 연결 대기 안내를 표시한다. 클라이언트에서 획득 기록을 직접 쓰거나 보안 규칙을 완화하지 않는다.
- 기존 함수의 새 계정 연결·갱신, 뱃지 전시 저장, 게시·수정·추천·삭제는 코드 연결을 완료했으나 이 검증에서 실제 운영 데이터를 변경하며 시험하지 않았다.
- Firebase 저장 스코어와 분포를 사용한다. 새 평균 조회 API를 통해 미보유 니케를 포함한 속성별 전체 평균과 개인 순위를 표시하고 평균 내림차순으로 정렬한다.
- Netlify 운영 배포 전 별도 미리보기에서 캐시·라우팅을 확인하고 최종 배포 대상을 확정한다. 현재 원본 사이트와 DNS는 그대로 유지한다.

보존된 OCI API는 `VITE_ACCOUNT_BACKEND=oci`로 명시할 때만 사용하며 현재 출시 기본 경로가 아니다.

참고: [Firebase 웹 설정](https://firebase.google.com/docs/web/setup), [Google 로그인](https://firebase.google.com/docs/auth/web/google-signin), [여러 Firestore 데이터베이스](https://firebase.google.com/docs/firestore/manage-databases).

## 평균 스코어 조회 API (2026-11-12 추가)

firebase-functions/는 기존 함수를 덮어쓰지 않는 별도 mimir-comparisons 코드베이스다. getMimirScoreComparisons는 Firebase ID 토큰과 연동 소유권을 확인한 후 nikke_score_distributions의 피해량 분포를 읽고 평균 피해량 × 5 ÷ 1억으로 평균 스코어를 계산한다. 개별 기록이나 분포는 클라이언트에 노출하지 않는다. 유효 정책·24시간 이내 통계·20개 이상의 표본을 사용하고, 개인 순위는 계산 버전도 일치해야 한다. 미보유 니케의 전체 평균도 반환하며 프런트엔드는 평균 내림차순으로 정렬한다. 기존 getNikkeScores와 병렬 조회하고 실패 시 기존 개인 점수는 유지한다.

배포 명령: firebase deploy --only functions:mimir-comparisons:getMimirScoreComparisons --project nikke-mimir --non-interactive

## 뱃지 저장 개선

전시는 최대 10개. getMimirScoreComparisons/badges/display에서 로그인·획득 여부를 검증하고 사용자 문서 한 건의 트랜잭션만 처리한다. 기존 공개 함수의 4개 제한과 충돌하지 않도록 작성자 조회도 /badges/showcase로 연결했다. 클라이언트는 변경 없는 저장을 비활성화하고 저장 성공 응답으로 캐시와 전시 화면을 갱신하여 추가 읽기를 생략한다. 기존 저장 API 실측은 1,188ms였다. 콜드 스타트 기여도 및 변경 후 속도 개선 배율은 측정하지 않았으므로 확정하지 않는다.

## 덱 추천 UI
추천/비추천은 위/아래 화살표로 표시하며 누르면 즉시 숫자와 주황 테두리를 갱신한다. 저장 중 중복 조작을 막고 실패 시 이전 상태를 복원한다. 내 추천 상태는 인증된 /decks/votes API에서 요청자 UID의 투표 문서만 최대 20건씩 읽는다. 추천 수 변경은 기존 voteSharedDeck 트랜잭션이 계속 처리한다. DILDORO로 복사는 덱 빌더와 동일한 외부 편성 코드 URL을 새 탭으로 연다.

## 별도 테스트 웹 배포 완료

2026-11-12 Netlify 새 사이트 https://mimir-mk2-test-20261112.netlify.app 에 배포했다. 사이트와 배포 ID는 netlify-test.json에 기록했다. 기존 사이트의 배포 ID는 작업 전후 동일함을 API로 검증했다. 새 테스트 호스트만 Firebase 로그인 허용 도메인에 추가했으며 기존 5개 도메인은 유지했다. HTTPS 홈 접속과 실제 공유 덱 조회를 확인했다. 새 호스트에서의 사용자 Google 로그인은 사용자가 다시 진행해야 하며 이 배포 검증에서 계정 인증을 완료한 것으로 간주하지 않는다. 테스트 사이트는 같은 Firebase를 쓰므로 저장 데이터가 격리된 샌드박스는 아니다.

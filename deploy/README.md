# 현재 운영 방향: Firebase + Netlify

2026-11-12 사용자 결정으로 OCI 전환은 보류합니다. 기존 Firebase 인증·데이터·서버 기능과 Netlify 웹 호스팅을 계속 사용합니다. 기본 클라이언트는 기존 Firebase에 연결했습니다. 기존 운영 자원과 DNS를 유지하며 운영 웹 배포는 별도입니다. 연결·검증 현황은 [firebase.md](firebase.md)를 확인하세요.

아래는 향후 검토를 위해 보존한 OCI 구성입니다. 현재 배포 절차로 실행하지 않습니다.

---

# MIMIR MK2 · OCI 운영 구성

MK1의 C:\MIMIR, Firebase 프로젝트, Netlify 배포, nikkemimir.xyz DNS는 변경하지 않습니다. MK2는 별도의 OCI 인스턴스·PostgreSQL·Google OAuth 클라이언트를 사용합니다. Firebase SDK나 MK1 Cloud Functions를 호출하지 않습니다.

## 준비된 구성과 아직 필요한 설정

- 웹: Caddy가 빌드된 TypeScript 사이트와 /api 프록시 제공
- API: Node.js/TypeScript, Google OIDC Authorization Code + PKCE, 서버 세션
- DB: PostgreSQL 17, Docker 영구 볼륨. 외부 DB 포트 공개 없음
- 동기화: OCI API가 BLABLALINK를 직접 호출. MK2 전용 소개글 확인 코드로 소유권 확인
- 스코어: 원본의 순수 계산 어댑터·정책·고정 조합을 사용하고 DILDORO 파트너 API 호출. 작업 상태와 결과는 MK2 PostgreSQL에 저장. 평균·상위 비율도 MK2의 동일 정책·계산 버전 표본으로만 집계하고 20개 미만은 비교값을 표시하지 않음
- 이미지: 현재 정적 에셋은 웹 컨테이너에 포함. 면허증·덱 캡처는 브라우저에서 생성하므로 업로드 저장소가 필요 없음

실제 인스턴스 생성, OAuth 클라이언트 등록, DNS 전환은 아직 수행하지 않았습니다. 현재 개발 PC에는 Docker/OCI CLI/Terraform가 없어 Docker 이미지 구동·OCI 생성 검증도 아직 하지 않았습니다. 서버 타입 검사·API/DB 연동 테스트는 로컬에서 수행합니다.

## 0. OCI 계정 가입

아직 OCI 계정이 없으므로 먼저 [Oracle 공식 가입 페이지](https://signup.oraclecloud.com/)에서 가입합니다. Oracle은 연락처와 카드 정보를 계정 설정·신원 확인에 사용하므로 이 입력과 약관 동의는 계정 소유자가 직접 진행합니다. [공식 FAQ](https://www.oracle.com/cloud/free/faq/)를 확인하세요. 카드 정보나 비밀번호를 프로젝트에 저장하지 않습니다. 가입 완료 후 OCI 콘솔 접근과 사용할 리전을 확인하고 다음 단계로 진행합니다.

## 1. OCI 인스턴스 준비

OCI 콘솔에서 새 Ubuntu 24.04 인스턴스를 만들거나 deploy/oci의 Terraform 구성을 사용합니다. 기존 MK1 리소스를 import하지 않습니다. Terraform은 새 VCN·서브넷·보안 목록·Compute를 만듭니다. 제공 shape는 예시이며 용량·비용은 실제 tenancy에서 확인해야 합니다.

```sh
cd deploy/oci
cp terraform.tfvars.example terraform.tfvars
# 로컬 파일에 OCI 식별자·SSH 공개키·관리자 IP/32 입력
terraform init
terraform plan
# 검토한 계획에 따라 실제 생성할 때만 실행
terraform apply
```

OCI 인증은 로컬 ~/.oci/config의 프로필을 사용합니다. 비밀키·OAuth secret·쿠키를 채팅이나 저장소에 넣지 않습니다. publish_web=false가 기본값입니다. 22번은 지정한 관리자 /32에서만 허용하고, 웹 공개 포트는 아직 열지 않습니다.

Terraform에는 Docker를 설치하는 Ubuntu bootstrap이 포함되어 있습니다. 콘솔에서 인스턴스를 만들었다면 파일을 전송하고 아래처럼 설치합니다.

```sh
sudo bash deploy/bootstrap-ubuntu.sh
```

## 2. 도메인 전환 전 SSH 터널로 확인

프로젝트를 /opt/mimir-mk2에 전송하고 .env.example을 .env로 복사합니다. 이 단계에서 nikkemimir.xyz DNS는 변경하지 않습니다.

```dotenv
APP_ORIGIN=http://localhost:8080
SITE_ADDRESS=:80
WEB_BIND=127.0.0.1
HTTP_PORT=8080
HTTPS_PORT=8443
POSTGRES_PASSWORD=<무작위 hex 비밀번호>
GOOGLE_CLIENT_ID=<MK2용 Google OAuth 웹 클라이언트 ID>
GOOGLE_CLIENT_SECRET=<MK2용 secret>
BLABLA_COOKIE=
DILDORO_API_KEY=<파트너 API 키, 없으면 스코어 계산은 설정 대기>
```

Google Cloud Console에서 **MK2 전용 Web application OAuth 클라이언트**를 만듭니다. 기존 MK1 OAuth 클라이언트를 수정하지 않습니다. Authorized redirect URI는 다음을 등록합니다.

```
http://localhost:8080/api/auth/google/callback
```

Google 동의 화면이 테스트 상태라면 테스트 사용자도 등록합니다. Google 비밀번호를 MK2에 저장하지 않습니다. 세션은 HttpOnly 쿠키이고, 서버에는 세션 토큰 해시만 저장합니다. HTTP 사용은 localhost SSH 터널에서만 허용됩니다.

```sh
cd /opt/mimir-mk2
chmod 600 .env
sudo docker compose up -d --build
sudo docker compose ps
```

개발 PC에서 연결을 유지합니다.

```sh
ssh -L 8080:127.0.0.1:8080 ubuntu@<OCI_IP>
```

http://localhost:8080 에서 로그인 → 확인 코드 발급 → BLABLALINK 소개글에 코드 추가 → 프로필 URL 입력 → 계정 동기화 순서로 확인합니다. 기존 소개글의 '미미르만만세' 문구는 유지하고 MK2 코드를 덧붙일 수 있습니다.

BLABLALINK가 서비스 쿠키를 요구하는 경우 서버 .env에 BLABLA_COOKIE를 설정해야 합니다. 인증/공개 설정이 맞지 않으면 오류를 표시하며 예시 데이터로 대체하지 않습니다. 저장 점수 확인 버튼은 계산을 추가 요청하지 않고 저장 결과만 읽습니다. 스코어 작업은 재시작 후 DB의 대기 작업에서 이어지며, 새 동기화 이전 결과는 revision 검사로 버립니다.

## 3. 나중에 nikkemimir.xyz 전환

MK2 검증과 DB 백업 후 별도 전환 작업에서만 진행합니다.

- Google MK2 클라이언트에 https://nikkemimir.xyz/api/auth/google/callback 추가
- .env: APP_ORIGIN=https://nikkemimir.xyz, SITE_ADDRESS=nikkemimir.xyz, WEB_BIND=0.0.0.0, HTTP_PORT=80, HTTPS_PORT=443
- OCI 보안 목록에서 80/443 허용(publish_web=true)
- DNS를 MK2 인스턴스로 전환한 뒤 Caddy HTTPS와 로그인 확인
- DNS 전환 전후 MK1과 MK2 계정 데이터는 자동 합쳐지지 않음. 과거 데이터 이관은 별도 작업

## 4. 백업·업데이트

```sh
sudo bash deploy/backup.sh
sudo docker compose up -d --build
```

백업은 backups/에 PostgreSQL custom-format으로 저장합니다. 실제 운영 전에는 별도 OCI Object Storage 버킷 등 **인스턴스 외부**로 정기 복사하고 복원도 시험합니다. db-data Docker 볼륨은 업데이트 시 보존합니다. `docker compose down -v`는 DB를 지우므로 배포 명령에 사용하지 않습니다.

## 로컬 개발과 테스트

```sh
npm ci
npm run dev:api
# 별도 터미널
npm run dev
# 확인
npm test
npm run build
npm run build:server
```

Vite는 /api를 localhost:3001로 프록시합니다. 로컬 로그인은 APP_ORIGIN=http://localhost:5173과 같은 주소로 접속하고 그 callback을 OAuth에 등록해야 합니다. DB·Google OAuth가 설정되지 않으면 실제 로그인 버튼은 비활성화됩니다. 예시 보기와 실제 계정은 구분됩니다.

API/DB 테스트는 테스트 전용 PGlite(PostgreSQL WASM)와 외부 인증/BLABLALINK 대역을 사용합니다. 실제 Google 인증, 파트너 API, OCI 네트워크와 Docker 운영 검증을 대신하지 않습니다.

참조: [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [Docker Ubuntu 설치](https://docs.docker.com/engine/install/ubuntu/), [OCI Compute Terraform](https://registry.terraform.io/providers/oracle/oci/latest/docs/resources/core_instance), [Caddy 프록시](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

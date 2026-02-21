# 🚀 Study English - GCP 배포 가이드 (Admin + Server)

> **목적**: Admin(Next.js) + Server(FastAPI) + DB(PostgreSQL)를 Google Cloud Platform에 배포.
> 프로덕션 유사 환경에서 정확한 레이턴시 측정이 가능한 테스트 환경 구축.
>
> **배포 완료 URL (고정)**:
> - **Server**: `https://study-english-server-963239184273.us-central1.run.app`
> - **Admin**: `https://study-english-admin-963239184273.us-central1.run.app`

---

## 1. GCP 프로젝트 정보

| 항목 | 값 |
|------|-----|
| **프로젝트 ID** | `gen-lang-client-0737324328` |
| **프로젝트명** | study-english |
| **크레딧 잔액** | ₩414,291 (~$300 USD) |
| **크레딧 만료일** | 2026년 5월 8일 |
| **리전** | `us-central1` (Cloud Run 무료 티어 적용) |

### 예상 월 비용

| 서비스 | 스펙 | 월 비용 |
|--------|------|---------|
| **Cloud Run (Server)** | 1 vCPU, 512MB, min 0 | **$0-5** |
| **Cloud Run (Admin)** | 1 vCPU, 512MB, min 0 | **$0-3** |
| **Cloud SQL (PostgreSQL)** | db-f1-micro, 10GB SSD | **~$11-13** |
| **합계** | | **~$12-15/월** |

> 5월 8일까지 ~$30-38 예상. 크레딧 $300으로 **완전 무료 운영**.

---

## 2. 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                Google Cloud (gen-lang-client-0737324328)             │
│                                                                     │
│  ┌──────────────────┐   ┌──────────────────┐                       │
│  │  Cloud Run       │   │  Cloud Run       │                       │
│  │  (Admin Next.js) │──▶│  (Server FastAPI) │                       │
│  │  *-admin-*.app   │   │  *-server-*.app  │                       │
│  └──────────────────┘   └────────┬─────────┘                       │
│                                  │                                   │
│                    ┌─────────────┼────────────┐                     │
│                    │             │             │                     │
│               ┌────▼────┐       │        ┌────▼────────────┐       │
│               │Cloud SQL│       │        │ Google APIs     │       │
│               │Postgres │       │        │ STT/TTS/Gemini  │       │
│               │Public IP│       │        │ (별도 프로젝트)  │       │
│               └─────────┘       │        └─────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 최초 배포 가이드

### 3.0 사전 준비

```bash
# gcloud 초기 설정
gcloud auth login
gcloud config set project gen-lang-client-0737324328
gcloud services enable run.googleapis.com sqladmin.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

---

### 3.1 Step 1: Cloud SQL (PostgreSQL) 생성

```bash
# PostgreSQL 인스턴스 생성 (Public IP 사용 — VPC 설정 생략)
gcloud sql instances create study-english-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=10GB

# 외부 연결 허용 (비밀번호 인증 필요)
gcloud sql instances patch study-english-db \
  --authorized-networks=0.0.0.0/0

# 데이터베이스 생성
gcloud sql databases create studyenglish --instance=study-english-db

# 사용자 비밀번호 설정
gcloud sql users set-password postgres \
  --instance=study-english-db \
  --password=<your-secure-password>
```

> ⏳ 인스턴스 생성에 5~10분 소요. `--no-assign-ip`는 VPC 네트워크 설정이 필요하므로 MVP에서는 생략.

---

### 3.2 Step 2: Server (FastAPI) 배포

```bash
cd apps/server

# Docker 이미지 빌드 (Cloud Build 사용, 3~5분)
gcloud builds submit --tag gcr.io/gen-lang-client-0737324328/study-english-server

# Cloud Run 서비스 배포 (환경변수는 한 줄로 작성)
gcloud run deploy study-english-server \
  --image gcr.io/gen-lang-client-0737324328/study-english-server \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars 'DATABASE_URL=postgresql+asyncpg://postgres:<DB비밀번호>@<Cloud-SQL-IP>:5432/studyenglish,REDIS_URL=,SECRET_KEY=<랜덤키>,GOOGLE_AI_API_KEY=<ENV참고>,GOOGLE_CLOUD_STT_TTS_API_KEY=<ENV참고>,DEBUG=false,CORS_ORIGINS=http://localhost:3000'
```

> ⚠️ `--set-env-vars`는 **줄바꿈 없이 한 줄로** 작성해야 합니다 (작은따옴표 안에서 `\`는 리터럴 문자로 해석됨).
> `<Cloud-SQL-IP>`는 인스턴스 생성 시 출력된 PRIMARY_ADDRESS 값 사용.

---

### 3.3 Step 3: Admin (Next.js) 배포

```bash
cd apps/admin

# cloudbuild.yaml을 통해 빌드 (NEXT_PUBLIC_API_URL을 build-arg로 전달)
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_API_URL=https://study-english-server-963239184273.us-central1.run.app

# Cloud Run 배포
gcloud run deploy study-english-admin \
  --image gcr.io/gen-lang-client-0737324328/study-english-admin \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2
```

> `gcloud builds submit`은 `--build-arg`를 지원하지 않으므로, `cloudbuild.yaml` + `--substitutions`를 사용합니다.

---

### 3.4 Step 4: CORS 업데이트

Admin 배포 후, Server에 Admin URL을 CORS에 추가:

```bash
gcloud run services update study-english-server \
  --region us-central1 \
  --update-env-vars '^||^CORS_ORIGINS=https://study-english-admin-963239184273.us-central1.run.app,http://localhost:3000'
```

> `^||^`는 gcloud에게 키-값 쌍을 `||`로 구분하라는 문법. CORS 값 안의 쉼표와 충돌 방지.

---

## 4. 재배포 (코드 수정 후)

URL은 바뀌지 않습니다. 코드 수정 후 스크립트 하나로 재배포:

```bash
./scripts/deploy-server.sh    # Server만 재배포
./scripts/deploy-admin.sh     # Admin만 재배포
./scripts/deploy-gcp.sh       # 전체 재배포
```

---

## 5. 스크립트 목록

| 스크립트 | 용도 |
|----------|------|
| `scripts/deploy-server.sh` | Server만 GCP 배포 |
| `scripts/deploy-admin.sh` | Admin만 GCP 배포 |
| `scripts/deploy-gcp.sh` | Server + Admin 전체 배포 |
| `scripts/start-local-dev.sh` | 로컬 전체 개발 (DB + Server + Admin) |
| `scripts/start-local-https.sh` | HTTPS 로컬 개발 (모바일 테스트용) |

---

## 6. 환경변수 관리

### Server (Cloud Run)

현재 Cloud Run에 설정된 환경변수:

| 변수명 | 설명 | 관리 위치 |
|--------|------|----------|
| `DATABASE_URL` | Cloud SQL 연결 문자열 | Cloud Run env |
| `REDIS_URL` | Redis 연결 (현재 미사용) | Cloud Run env |
| `SECRET_KEY` | JWT 서명 키 | Cloud Run env |
| `GOOGLE_AI_API_KEY` | Gemini API Key (별도 프로젝트) | Cloud Run env |
| `GOOGLE_CLOUD_STT_TTS_API_KEY` | STT/TTS API Key | Cloud Run env |
| `DEBUG` | 디버그 모드 (false) | Cloud Run env |
| `CORS_ORIGINS` | 허용 Origin (쉼표 구분) | Cloud Run env |

### Server 로컬 개발 (.env)

추가로 `.env`에는 있지만 Cloud Run에 **아직 미설정**인 변수:

| 변수명 | 설명 | Cloud Run 설정 필요? |
|--------|------|---------------------|
| `APP_NAME` | 앱 이름 | ❌ 기본값 OK |
| `API_V1_PREFIX` | API 경로 | ❌ 기본값 OK |
| `ALGORITHM` | JWT 알고리즘 | ❌ 기본값 OK |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 토큰 만료 | ❌ 기본값 OK |
| `REFRESH_TOKEN_EXPIRE_DAYS` | 리프레시 만료 | ❌ 기본값 OK |
| `KAKAO_CLIENT_ID/SECRET` | 카카오 OAuth | ⏳ 추후 필요 시 |
| `NAVER_CLIENT_ID/SECRET` | 네이버 OAuth | ⏳ 추후 필요 시 |
| `GOOGLE_CLIENT_ID/SECRET` | 구글 OAuth | ⏳ 추후 필요 시 |
| `OPENAI_API_KEY` | OpenAI (선택) | ⏳ 추후 필요 시 |

### Admin (Cloud Run)

| 변수명 | 설명 | 관리 위치 |
|--------|------|----------|
| `NEXT_PUBLIC_API_URL` | Server URL | **빌드 시 주입** (cloudbuild.yaml) |

> `NEXT_PUBLIC_*` 변수는 **빌드 타임**에 임베드됩니다. 런타임 환경변수로는 변경 불가.
> Server URL을 바꾸려면 Admin을 **재빌드**해야 합니다.

### Cloud Run 환경변수 업데이트 방법

```bash
# 단일 변수 업데이트
gcloud run services update study-english-server \
  --region us-central1 \
  --update-env-vars 'SECRET_KEY=new-value'

# 여러 변수 (쉼표 포함 값이 있을 때)
gcloud run services update study-english-server \
  --region us-central1 \
  --update-env-vars '^||^KEY1=val1||KEY2=val2'

# 현재 설정 확인
gcloud run services describe study-english-server \
  --region us-central1 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

---

## 7. 배포 확인 체크리스트

```
✅ Server Health: curl https://study-english-server-963239184273.us-central1.run.app/health
✅ API Docs: https://study-english-server-963239184273.us-central1.run.app/docs
✅ Admin: https://study-english-admin-963239184273.us-central1.run.app
✅ DB 마이그레이션: Cloud Run 로그에서 "alembic upgrade head" 성공 확인
✅ CORS: Admin에서 Server API 호출 정상 동작
```

---

## 8. FAQ

### Q: Cloud Run에서 실시간 로그를 볼 수 있나요?

```bash
gcloud run logs read study-english-server --region us-central1 --limit=30
```
또는 GCP Console → Cloud Run → 서비스 → Logs 탭.

### Q: DB 데이터를 로컬에서 Cloud SQL로 옮기려면?

```bash
# 로컬 DB 백업
pg_dump -Fc postgres://postgres:postgres@localhost:5432/studyenglish > backup.dump

# Cloud SQL에 직접 연결하여 복원
pg_restore -h <Cloud-SQL-IP> -U postgres -d studyenglish backup.dump
```

### Q: 커스텀 도메인 사용 가능?

Cloud Run 설정에서 커스텀 도메인을 매핑할 수 있습니다 (DNS 설정 필요).

### Q: us-central1이 아닌 서울 리전을 쓸 수 없나?

Cloud Run **무료 티어**는 `us-central1`, `us-east1`, `us-west1`에서만 적용됩니다.
서울(`asia-northeast3`)을 사용하면 무료 티어가 적용되지 않아 비용이 증가합니다.
한국→미국 레이턴시 ~150ms는 MVP 테스트에 충분하며, 프로덕션 전환 시 서울 리전 이전을 고려하세요.

### Q: 비밀번호/API Key 변경이 필요하면?

```bash
# Cloud SQL 비밀번호 변경
gcloud sql users set-password postgres \
  --instance=study-english-db \
  --password=<new-password>

# Cloud Run 환경변수 업데이트
gcloud run services update study-english-server \
  --region us-central1 \
  --update-env-vars 'DATABASE_URL=postgresql+asyncpg://postgres:<new-password>@<IP>:5432/studyenglish'
```

# FastAPI 백엔드 서버 초기화 완료

## 생성된 파일

`apps/server/` 폴더에 22개의 파일을 생성했습니다:

### Core Files
| 파일 | 설명 |
|------|------|
| [pyproject.toml](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/pyproject.toml) | Poetry 의존성 관리 |
| [main.py](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/app/main.py) | FastAPI 앱 진입점 |
| [config.py](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/app/core/config.py) | 환경 변수 설정 |
| [database.py](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/app/core/database.py) | SQLAlchemy async DB |
| [security.py](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/app/core/security.py) | JWT 토큰 관리 |
| [deps.py](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/app/api/deps.py) | 공통 API 의존성 |

### Infrastructure
| 파일 | 설명 |
|------|------|
| [docker-compose.yml](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/docker-compose.yml) | PostgreSQL + Redis + API |
| [Dockerfile](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/Dockerfile) | 프로덕션 이미지 |
| [.env.example](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/.env.example) | 환경 변수 템플릿 |

---

## 프로젝트 구조

```
apps/server/
├── app/
│   ├── api/
│   │   ├── deps.py           # get_db, get_current_user
│   │   └── v1/router.py      # v1 API 라우터
│   ├── core/
│   │   ├── config.py         # Pydantic Settings
│   │   ├── database.py       # AsyncSession
│   │   ├── security.py       # JWT
│   │   └── exceptions.py     # HTTPException
│   ├── models/base.py        # SQLAlchemy Base
│   ├── schemas/common.py     # 공통 스키마
│   ├── services/ai/          # LangChain (준비)
│   └── main.py               # 진입점
├── migrations/               # Alembic
├── tests/                    # pytest
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml
└── README.md
```

---

## 다음 단계

> [!IMPORTANT]
> Poetry와 Python 3.11+가 설치되어 있어야 합니다.

```bash
# 1. apps/server 폴더로 이동
cd apps/server

# 2. 환경 변수 설정
cp .env.example .env

# 3. 의존성 설치
poetry install

# 4. Docker로 DB 실행 (또는 docker-compose up -d)
docker-compose up -d db redis

# 5. 개발 서버 실행
poetry run uvicorn app.main:app --reload --port 8000

# 6. 확인
open http://localhost:8000/docs
```

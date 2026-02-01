# 서버 MVP API 구현 완료

## 구현 현황

| 항목 | 수량 |
|------|------|
| 총 파일 | 35개 |
| API 엔드포인트 | 20개 |
| 모듈 | 5개 |

---

## API Endpoints

### 🧪 Variables (4)
- `GET /api/v1/variables` - 전체 변수
- `GET /api/v1/variables/theme/{theme}` - 테마별
- `GET /api/v1/variables/user/{user_id}` - 사용자별 (A/B)
- `PUT /api/v1/variables/{id}` - 수정

### 🤖 Prompts (6)
- `GET/POST /api/v1/prompts` - 목록/생성
- `GET/PATCH /api/v1/prompts/{id}` - 상세/수정
- `POST /api/v1/prompts/{id}/versions` - 버전 추가
- `POST /api/v1/prompts/test` - 테스트

### 📦 Scenarios (6)
- `GET/POST /api/v1/scenarios` - 목록/생성
- `GET/PATCH/DELETE /api/v1/scenarios/{id}` - 상세/수정/삭제
- `POST /api/v1/scenarios/{id}/steps` - 스텝 추가

### 📊 Logs (3)
- `POST /api/v1/logs` - 로그 생성
- `POST /api/v1/logs/batch` - 배치 생성
- `GET /api/v1/logs` - 로그 조회

### 📈 Analytics (1)
- `GET /api/v1/analytics/summary` - 분석 요약

---

## 다음 단계

```bash
cd apps/server
poetry install
docker-compose up -d db redis
poetry run alembic upgrade head
poetry run uvicorn app.main:app --reload
```

http://localhost:8000/docs 에서 API 확인

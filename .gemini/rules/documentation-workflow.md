# 📝 문서화 워크플로우 (Documentation Workflow)

> 모든 기획, 개발, 실행계획은 반드시 문서로 기록되어야 합니다.
> 이 규칙은 대화 내용의 추적성과 프로젝트 일관성을 보장합니다.

---

## 1. 문서 디렉토리 구조

```
/docs
├── plan/               # 기획 문서
│   ├── service-overview.md
│   ├── onboarding-flow.md
│   ├── level-system.md
│   ├── admin-page.md
│   └── ...
├── develop/            # 개발 문서
│   ├── data-schema.md
│   ├── api-endpoints.md
│   └── ...
└── tasks/              # 실행계획 문서
    ├── TASK-001-documentation-setup.md
    ├── TASK-002-onboarding-planning.md
    └── ...
```

---

## 2. 문서 작성 원칙

### 2.1. 모든 문서에 포함해야 할 내용

1. **사용자 지시/질문** - 사용자가 요청하거나 물어본 원문
2. **정리된 내용** - 내가 분석/기획/개발한 결과
3. **의사결정 기록** - 왜 이런 결정을 했는지 (Decision Log)
4. **다음 단계** - 후속 작업이 있다면 명시

### 2.2. 문서 헤더 템플릿

```markdown
# [문서 제목]

| 항목 | 내용 |
|------|------|
| **작성일** | YYYY-MM-DD |
| **상태** | Draft / In Review / Approved |
| **관련 문서** | 링크 |

---

## 📋 사용자 요청 (User Request)

> 사용자가 지시하거나 물어본 원문을 인용

---

## 📝 정리 내용 (Summary)

... 분석/기획/개발 결과 ...

---

## 🔜 다음 단계 (Next Steps)

- [ ] 후속 작업 1
- [ ] 후속 작업 2
```

---

## 3. 실행계획 (Task) 문서 규칙

### 3.1. 파일명 형식
```
TASK-{번호}-{간단한-설명}.md
예: TASK-001-documentation-setup.md
```

### 3.2. Task 문서 템플릿

```markdown
# TASK-{번호}: {제목}

| 항목 | 내용 |
|------|------|
| **생성일** | YYYY-MM-DD |
| **상태** | 🔴 Not Started / 🟡 In Progress / 🟢 Done |
| **우선순위** | High / Medium / Low |

---

## 📋 배경 (Background)

사용자 요청 또는 작업 필요성 설명

---

## ✅ 체크리스트 (Checklist)

- [ ] 작업 항목 1
- [ ] 작업 항목 2
- [ ] 작업 항목 3

---

## 📝 진행 기록 (Progress Log)

### YYYY-MM-DD
- 완료한 작업 내용
- 발생한 이슈 및 해결 방법

---

## 🔗 관련 문서

- [기획 문서](../plan/xxx.md)
- [개발 문서](../develop/xxx.md)
```

---

## 4. 문서 유형별 저장 위치

| 문서 유형 | 저장 위치 | 예시 |
|----------|----------|------|
| 서비스 기획 | `/docs/plan/` | service-overview.md |
| 기능 기획 | `/docs/plan/` | onboarding-flow.md |
| 벤치마킹 | `/docs/plan/` | level-system-benchmark.md |
| 데이터 설계 | `/docs/develop/` | data-schema.md |
| API 설계 | `/docs/develop/` | api-endpoints.md |
| 실행 계획 | `/docs/tasks/` | TASK-001-xxx.md |

---

## 5. 워크플로우

```mermaid
graph LR
    A[사용자 요청] --> B{문서 유형 판단}
    B -->|기획| C[/docs/plan/ 문서 생성]
    B -->|개발| D[/docs/develop/ 문서 생성]
    B -->|큰 작업| E[/docs/tasks/ Task 생성]
    
    C --> F[작업 수행]
    D --> F
    E --> F
    
    F --> G[문서 업데이트]
    G --> H[상태 변경]
```

---

## 6. 자동 참조 규칙

- 새로운 대화 시작 시 `/docs/` 하위 문서들을 확인하여 컨텍스트 파악
- 이전 결정사항과 충돌하지 않는지 검토
- 관련 문서가 있으면 링크로 연결

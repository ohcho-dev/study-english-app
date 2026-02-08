# 대화 시나리오 기능 테스트 가이드

> **버전**: 1.0  
> **작성일**: 2026-02-09  
> **대상**: 템플릿 관리, 대화 실험, 세션 기록 기능

---

## 🎯 테스트 목표

- 템플릿 CRUD 검증
- 대화 실험 파이프라인 검증 (음성 → STT → LLM → TTS)
- 레이턴시 측정 및 세션 기록 검증

---

## 📋 테스트 템플릿 (3개)

### 템플릿 1: 기본 인사 (Baseline)

| 필드 | 값 |
|------|-----|
| 이름 | `기본 인사 테스트` |
| 설명 | 간단한 인사 교환으로 베이스라인 레이턴시 측정 |
| 모드 | `턴 기반` |
| 주제 | `Greetings` |
| 난이도 | `1` |
| 예상 시간 | `5분` |
| 시스템 프롬프트 | `You are a friendly English tutor. Keep responses to 1-2 sentences.` |
| 인사말 | `Hello! How are you today?` |
| 참여자 | AI: en-US-Wavenet-F |

**테스트 발화**: "Hello, I'm doing great. Nice to meet you."

---

### 템플릿 2: 카페 주문 (Role-play)

| 필드 | 값 |
|------|-----|
| 이름 | `카페 주문 롤플레이` |
| 설명 | 카페에서 음료 주문하는 상황극 |
| 모드 | `턴 기반` |
| 주제 | `Ordering at a Cafe` |
| 난이도 | `2` |
| 예상 시간 | `10분` |
| 시스템 프롬프트 | `You are a friendly barista at a coffee shop. Ask about drink preferences, sizes, and customizations. Keep responses natural and concise (2-3 sentences max).` |
| 인사말 | `Hi there! Welcome to our cafe. What can I get for you today?` |
| 참여자 | AI: en-US-Wavenet-D (남성 음성) |

**테스트 발화 시퀀스**:
1. "I'd like a coffee, please."
2. "Medium size, with milk."
3. "Yes, that's all. Thank you!"

---

### 템플릿 3: 자유 대화 (Free-form)

| 필드 | 값 |
|------|-----|
| 이름 | `자유 영어 대화` |
| 설명 | 주제 제한 없는 자유로운 영어 대화 |
| 모드 | `자유 형식` |
| 주제 | `Free Conversation` |
| 난이도 | `3` |
| 예상 시간 | `15분` |
| 시스템 프롬프트 | `You are a conversational AI practicing English with the user. Be engaging, ask follow-up questions, and keep the conversation flowing naturally.` |
| 인사말 | `Hey! What's on your mind today? Feel free to talk about anything.` |
| 참여자 | AI: en-US-Wavenet-C (여성 음성) |

**테스트 발화**: "I went to a really nice restaurant yesterday."

---

## 🔬 실험 설정 시나리오

### 시나리오 A: 빠른 베이스라인 테스트

| 설정 | 값 |
|------|-----|
| 워밍업 | 2회 |
| 테스트 | 5회 |
| 목표 레이턴시 | 3000ms |
| 최대 레이턴시 | 5000ms |
| 자동 재생 | ON |
| 메트릭 표시 | ON |

**목적**: 빠르게 파이프라인 정상 작동 확인

---

### 시나리오 B: 정밀 성능 측정

| 설정 | 값 |
|------|-----|
| 워밍업 | 3회 |
| 테스트 | 10회 |
| 목표 레이턴시 | 2500ms |
| 최대 레이턴시 | 4000ms |
| 자동 재생 | ON |
| 메트릭 표시 | ON |

**목적**: 통계적으로 유의미한 레이턴시 데이터 수집

---

### 시나리오 C: 음성 품질 테스트

| 설정 | 값 |
|------|-----|
| 워밍업 | 1회 |
| 테스트 | 3회 |
| 목표 레이턴시 | 5000ms (느슨하게) |
| 자동 재생 | ON |
| 메트릭 표시 | OFF |

**목적**: 음성 재생 품질에 집중하여 듣기 테스트

---

## 📊 예상 결과

### 대화 실험 - 메트릭 대시보드

```
┌────────────────────────────────────────────┐
│ 📊 E2E 레이턴시                             │
│ ├─ 평균: 2,847ms                           │
│ ├─ P50:  2,650ms                           │
│ ├─ P95:  3,420ms                           │
│ └─ 목표 달성: ✅                            │
├────────────────────────────────────────────┤
│ 📈 구간별 분석                              │
│ ├─ STT: 450ms (avg)                        │
│ ├─ LLM: 1,200ms (avg)                      │
│ └─ TTS: 380ms (avg)                        │
└────────────────────────────────────────────┘
```

### 세션 기록 목록

| 상태 | 템플릿 | 시작 시간 | 턴 수 | 총 시간 |
|------|--------|-----------|-------|---------|
| ✅ 완료 | 기본 인사 테스트 | 14:30:25 | 7 | 3분 42초 |
| ✅ 완료 | 카페 주문 롤플레이 | 14:35:10 | 12 | 8분 15초 |
| 🔄 진행중 | 자유 영어 대화 | 14:45:00 | 5 | - |

### 세션 상세 - 대화 탭

```
┌─────────────────────────────────────────┐
│ 👤 You                                  │
│ "I'd like a coffee, please."            │
│                                         │
│ 🤖 AI                                   │
│ "Great choice! Would you like that      │
│ hot or iced? And what size?"            │
│ [▶ 오디오 재생]                          │
├─────────────────────────────────────────┤
│ 👤 You                                  │
│ "Medium size, with milk."               │
│                                         │
│ 🤖 AI                                   │
│ "Perfect! A medium coffee with milk.    │
│ Anything else for you today?"           │
│ [▶ 오디오 재생]                          │
└─────────────────────────────────────────┘
```

### 세션 상세 - 메트릭 탭

| Turn | STT | LLM | TTS | Server | E2E |
|------|-----|-----|-----|--------|-----|
| 1 | 423ms | 1,156ms | 342ms | 1,921ms | 2,847ms |
| 2 | 398ms | 1,089ms | 356ms | 1,843ms | 2,654ms |
| 3 | 445ms | 1,234ms | 378ms | 2,057ms | 2,912ms |

---

## ✅ 기능 체크리스트

### 템플릿 관리

- [ ] 새 템플릿 생성
- [ ] 템플릿 편집
- [ ] 템플릿 복제
- [ ] 템플릿 삭제
- [ ] 템플릿 검색 (이름/설명)
- [ ] 모드 필터 (턴 기반 / 자유 형식)
- [ ] "실험 시작" 버튼 → 대화 실험 페이지 이동

### 대화 실험

- [ ] 템플릿 선택 드롭다운
- [ ] URL 파라미터로 템플릿 자동 선택
- [ ] 실험 설정 변경 (워밍업, 테스트 횟수, 목표 레이턴시)
- [ ] 음성 녹음 → 전송
- [ ] STT 결과 표시
- [ ] LLM 응답 표시
- [ ] TTS 음성 자동 재생
- [ ] 실시간 메트릭 대시보드
- [ ] 워밍업 vs 테스트 구분
- [ ] CSV 내보내기

### 세션 기록

- [ ] 세션 목록 조회
- [ ] 상태별 필터 (진행중 / 완료 / 실패)
- [ ] 세션 상세 보기 → 대화 내용
- [ ] 세션 상세 보기 → 메트릭 탭
- [ ] 오디오 재생

---

## 🚀 테스트 실행 순서

### 1. 서버 시작

```bash
cd apps/server
poetry run uvicorn app.main:app --reload
```

### 2. Admin 시작

```bash
cd apps/admin
npm run dev
```

### 3. 템플릿 생성

`http://localhost:3000/conversations/templates/new`

위 3개 템플릿 순서대로 생성

### 4. 실험 실행

1. "기본 인사 테스트" 템플릿에서 "실험 시작" 클릭
2. 시나리오 A 설정으로 5회 테스트 진행

### 5. 결과 확인

`http://localhost:3000/conversations/sessions`

생성된 세션 클릭하여 대화 내용 및 메트릭 확인

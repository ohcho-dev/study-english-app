---
name: cross-validate
description: >
  Claude가 자체 분석을 수행하는 동시에 tmux를 통해 Gemini CLI에 동일 작업을 위임하고,
  두 AI의 결과를 종합해 합의/이견을 정리하는 교차 검증 스킬.
  코드 리뷰, 설계 검토, 구현 계획, 로직 검증 등 어떤 내용이든 두 AI의 시각으로 검토할 때 사용한다.
  트리거: "교차검증", "cross-validate", "cross validate", "양쪽에서 검토", "gemini랑 같이",
  "다른 모델이랑 비교", "두 AI로 검토", "Gemini한테도 물어봐", "gemini도 봐줘", "두 관점으로",
  "같이 검토해줘", "두 모델로 확인"
---

# Cross Validate — Claude × Gemini 교차 검증

사용자가 **Claude에게만 명령**하면, Claude가:
1. 자체 분석 수행 (Gemini와 독립적으로)
2. tmux를 통해 Gemini CLI에 동일 작업 위임
3. 두 결과를 종합해 합의·이견을 정리한 최종 보고

교차 검증의 가치는 **독립성**에 있다. Claude가 분석한 내용을 Gemini에게 미리 노출하지 않아야 한다.

---

## 워크플로우

### Step 0: 초기화

```bash
mkdir -p .cross-review
```

- `id` = 현재 타임스탬프 `YYYYMMDD_HHMMSS`
- 작업 파일 경로:
  - Claude 분석: `.cross-review/claude-{id}.md`
  - Gemini 프롬프트: `.cross-review/gemini-prompt-{id}.md`
  - Gemini 응답: `.cross-review/gemini-response-{id}.md`
  - 최종 보고서: `.cross-review/report-{id}.md`

---

### Step 1: Gemini pane 탐지

**1-1. pane 목록 조회**

```bash
tmux list-panes -a -F "#{session_name}:#{window_index}.#{pane_index} #{pane_current_command} #{pane_title}"
```

**1-2. Gemini CLI pane 식별 (우선순위 순)**

아래 방법을 순서대로 시도한다:

1. **pane title 확인**: `gemini`가 포함된 pane title
2. **pane 내용 확인**: 각 pane의 최근 출력에서 Gemini CLI 특유의 프롬프트(`╭─`, `❯`, `Gemini`) 패턴 탐색
   ```bash
   tmux capture-pane -t {pane_id} -p | tail -20
   ```
3. **프로세스 이름 확인**: `node` 프로세스 중 Gemini 관련 경로를 가진 pane
   ```bash
   tmux list-panes -a -F "#{session_name}:#{window_index}.#{pane_index} #{pane_current_command} #{pane_pid}"
   ```

**1-3. 탐지 실패 시**

자동 탐지에 실패하면 사용자에게 다음 메시지와 함께 확인 요청:

```
Gemini CLI가 실행 중인 tmux pane을 찾지 못했습니다.
현재 열린 pane 목록:
{list_output}

Gemini가 실행 중인 pane을 알려주세요 (예: study-english:2.1)
```

---

### Step 2: Claude 독립 분석

검증 대상에 대해 **독립적으로** 분석 수행. Gemini 결과를 기다리지 않는다.

분석 항목:
- **정확성**: 로직/코드/내용의 오류 여부
- **잠재 문제**: 엣지 케이스, 보안, 성능 이슈
- **개선 제안**: 더 나은 접근법
- **최종 판정**: GO / NO-GO / 조건부 GO

결과를 `.cross-review/claude-{id}.md`에 저장:

```markdown
# Claude 분석 — {id}

## 검증 대상
{subject}

## 분석 결과
{findings}

## 잠재 문제
{issues}

## 개선 제안
{suggestions}

## 판정
GO / NO-GO / 조건부 GO
```

---

### Step 3: Gemini 프롬프트 작성 및 전송

**3-1. 프롬프트 파일 작성** — `.cross-review/gemini-prompt-{id}.md`:

```markdown
# 교차 검증 요청 — {id}

아래 내용을 독립적으로 분석하고, 결과를 반드시
`.cross-review/gemini-response-{id}.md` 파일에 저장해줘.

## 검증 대상

{검증 대상 전체 내용}

## 분석 요청 항목

1. 정확성 검토 (로직/코드/내용의 오류)
2. 잠재 문제 (엣지 케이스, 보안, 성능)
3. 개선 제안
4. 최종 판정: GO / NO-GO / 조건부 GO

## 응답 형식

아래 형식으로 `.cross-review/gemini-response-{id}.md` 에 저장:

---
# Gemini 분석 — {id}

## 분석 결과
(내용)

## 잠재 문제
(내용)

## 개선 제안
(내용)

## 판정
GO / NO-GO / 조건부 GO
---

파일 저장 후 "Gemini 검증 완료: {id}" 라고 출력해줘.
```

**3-2. tmux로 Gemini에 전송**:

```bash
tmux send-keys -t {GEMINI_PANE} "@.cross-review/gemini-prompt-{id}.md" Enter
```

사용자에게 알림: "Gemini에게 검증을 요청했습니다. 응답을 기다리는 중..."

---

### Step 4: Gemini 응답 대기

두 가지 방법을 병행해 응답을 감지한다. **파일 생성** 또는 **완료 메시지** 중 어느 쪽이든 먼저 확인되면 Step 5로 진행한다.

**최대 대기 시간**: 180초 / **폴링 간격**: 10초

각 폴링 주기마다 순서대로 확인:

**방법 A: 응답 파일 존재 확인**
```bash
test -f .cross-review/gemini-response-{id}.md && echo "FILE_FOUND"
```

**방법 B: tmux capture-pane으로 완료 메시지 확인**
```bash
tmux capture-pane -t {GEMINI_PANE} -p | grep -q "Gemini 검증 완료: {id}" && echo "MSG_FOUND"
```

**방법 B가 먼저 감지된 경우 (파일 없음):**
Gemini가 응답했지만 파일 저장에 실패한 상황. capture-pane으로 전체 응답을 추출해 수동으로 파일 생성:
```bash
tmux capture-pane -t {GEMINI_PANE} -p -S -300 > .cross-review/gemini-capture-{id}.txt
```
capture 내용에서 분석 결과 구간을 파싱해 `.cross-review/gemini-response-{id}.md`로 저장한다.

**타임아웃(180초) 도달 시:**
Claude 단독 결과로 Step 5를 진행하되 보고서에 Gemini 미응답을 명시한다.

---

### Step 5: 종합 보고

두 분석 파일을 읽고 다음 구조로 종합 보고서를 작성한 뒤, 대화창에 출력하고 `.cross-review/report-{id}.md`에도 저장한다.

```markdown
# 교차 검증 보고서 — {id}

## 검증 대상
{subject}

---

## Claude 분석 요약
{claude_summary}
**판정**: {claude_verdict}

---

## Gemini 분석 요약
{gemini_summary}
**판정**: {gemini_verdict}

---

## 합의 사항 ✅
> 두 에이전트가 동의한 내용
- {point1}
- {point2}

## 이견 사항 ⚠️
> 관점이 다른 부분 — 주의 깊게 검토 필요
| 항목 | Claude | Gemini |
|------|--------|--------|
| {item} | {claude_view} | {gemini_view} |

---

## 최종 종합 판정

| | Claude | Gemini | 종합 |
|--|--------|--------|------|
| 판정 | {c_verdict} | {g_verdict} | **{final}** |

### 근거
{reasoning}

### 권장 액션
1. {action1}
2. {action2}
```

---

### Step 6: 파일 정리 (선택)

세션 파일이 누적되지 않도록, 보고서 저장 후 **7일 이상 된 `.cross-review/` 파일**을 정리한다.

```bash
find .cross-review -name "*.md" -mtime +7 -delete 2>/dev/null
```

단, 사용자가 명시적으로 보관 의사를 밝힌 경우 생략한다.

---

## 판정 규칙

| Claude | Gemini | 종합 판정 |
|--------|--------|----------|
| GO | GO | ✅ GO |
| GO | 조건부 GO | ⚠️ 조건부 GO |
| 조건부 GO | GO | ⚠️ 조건부 GO |
| NO-GO | GO | ⚠️ 조건부 GO (이견 상세 검토 필요) |
| NO-GO | NO-GO | ❌ NO-GO |
| GO | 미응답 | ⚠️ Claude 단독 GO (Gemini 미확인) |
| NO-GO | 미응답 | ❌ NO-GO (Gemini 미확인) |
| 조건부 GO | 미응답 | ⚠️ Claude 단독 조건부 GO (Gemini 미확인) |

---

## 사용 예시

```
# 코드 교차 검증
이 함수 교차검증 해줘 @apps/server/app/services/conversation/run0_service.py

# 플랜 교차 검증
이 구현 계획 gemini랑 같이 검토해줘

# 일반 내용 교차 검증
아래 내용 양쪽에서 검토해줘:
[검증할 내용]

# 자연스러운 표현도 OK
이 코드 다른 모델이랑 비교해서 봐줘
Gemini한테도 이 설계 물어봐줘
두 AI로 이 로직 확인해줘
```

---

## 주의 사항

- Gemini CLI가 tmux에서 실행 중이어야 함
- `.cross-review/` 디렉토리는 `.gitignore`에 추가 권장
- 각 검증은 독립적으로 수행 — Claude 분석 내용을 Gemini 프롬프트에 포함하지 않음 (교차 오염 방지)

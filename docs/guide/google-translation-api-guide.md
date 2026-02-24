# Google 번역 API 완전 가이드

> **작성일**: 2026-02-24  
> **대상**: 오디오/AI 도메인 처음 학습자  
> **목적**: Google에서 제공하는 3가지 번역 API의 특징, 가격, 커스터마이징, API 사용법을 체계적으로 학습하기 위한 가이드

---

## 📖 기술 용어 사전

### 번역 기술 기본 개념

| 용어 | 영문 | 쉬운 설명 |
|------|------|----------|
| **NMT** | Neural Machine Translation | **신경망 기계 번역**. 딥러닝으로 학습한 번역 모델. "AI가 문장 전체를 이해하고 번역하는 방식". Google 번역에 사용됨 |
| **SMT** | Statistical Machine Translation | **통계적 기계 번역**. 대량의 번역 데이터에서 통계적 패턴을 학습. NMT 이전의 구세대 기술 |
| **LLM** | Large Language Model | **대규모 언어 모델**. ChatGPT, Gemini 같은 AI의 기반 기술. 수천억 개의 텍스트로 학습 |
| **파운데이션 모델** | Foundation Model | 다양한 작업에 공통으로 쓸 수 있는 **기초 AI 모델**. 여기서 파생해서 번역, TTS 등 특화 모델을 만듦 |
| **미세 조정** | Fine-tuning | 이미 학습된 AI 모델을 특정 용도(예: 한→영 번역)에 맞게 **추가 학습**하는 것 |
| **용어집** | Glossary | 특정 단어/용어의 번역을 **고정**하는 사전. 예: "session" → 항상 "세션"으로 번역 |
| **적응형 번역** | Adaptive Translation | 예시 번역 데이터를 제공하여 번역 스타일을 **실시간으로 학습**시키는 기능 |
| **배치 번역** | Batch Translation | 대량의 텍스트를 한 번에 **일괄 처리**하는 방식. Cloud Storage에 올려놓고 처리 |
| **AutoML** | Automated Machine Learning | 코딩 없이 자체 데이터로 **커스텀 AI 모델을 학습**시키는 Google 서비스 |
| **GA** | General Availability | 정식 출시. 프로덕션에서 안심하고 사용 가능 |
| **프리뷰** | Preview | 테스트 단계. 기능 변경/중단 가능 |
| **BCP-47** | BCP-47 Language Code | 언어를 표기하는 국제 표준. 예: `en` = 영어, `ko` = 한국어, `ja` = 일본어 |
| **MIME Type** | MIME Type | 데이터의 형식을 나타내는 표준. `text/plain` = 일반 텍스트, `text/html` = HTML |

### 인증 관련 용어

| 용어 | 쉬운 설명 |
|------|----------|
| **API 키** | 단순한 문자열 비밀번호. URL에 붙여서 보냄. 간단하지만 보안이 약함 |
| **서비스 계정** | Google Cloud가 만들어주는 "가상 계정". JSON 키 파일로 인증. 보안 강함 |
| **ADC** | Application Default Credentials. **자동 인증**. Cloud Run에서는 별도 설정 없이 사용 가능 |
| **IAM** | Identity and Access Management. **누가 무엇을 할 수 있는지** 권한 관리 |

---

## 🌏 한국에서의 사용 가능 여부

| 항목 | 사용 가능 | 비고 |
|------|----------|------|
| **Cloud Translation - Basic (v2)** | ✅ | 글로벌 엔드포인트, API 키 사용 가능 |
| **Cloud Translation - Advanced (v3)** | ✅ | 글로벌 엔드포인트 |
| **Vertex AI Translation** | ✅ | us-central1 등 리전 지정 필요 |
| **한국어 지원** | ✅ | 3가지 모두 한국어(ko) 지원 |
| **결제** | ✅ | 한국 신용카드/계정 사용 가능 |
| **무료 할당량** | ✅ | 월 50만 자 무료 ($10 크레딧) |

---

## 📋 목차

1. [제품 개요](#1-제품-개요)
2. [상세 비교표](#2-상세-비교표)
3. [Cloud Translation - Basic (v2)](#3-cloud-translation---basic-v2)
4. [Cloud Translation - Advanced (v3)](#4-cloud-translation---advanced-v3)
5. [Vertex AI Translation (번역 LLM)](#5-vertex-ai-translation-번역-llm)
6. [가격 비교](#6-가격-비교)
7. [커스터마이징 비교](#7-커스터마이징-비교)
8. [API 사용법](#8-api-사용법)
9. [우리 서비스 최적 제품 분석](#9-우리-서비스-최적-제품-분석)
10. [마이그레이션 가이드](#10-마이그레이션-가이드)

---

## 1. 제품 개요

Google은 번역을 위해 **3가지 제품**을 제공합니다:

| 제품 | 엔진 | 출시 상태 | SDK |
|------|------|---------|-----|
| **Cloud Translation - Basic** | NMT (인공신경망 기계 번역) | GA (정식) | `google-cloud-translate` (v2) |
| **Cloud Translation - Advanced** | NMT + 번역 LLM | GA (정식) | `google-cloud-translate` (v3) |
| **Vertex AI Translation** | 번역 LLM + NMT | GA (정식) | `google-cloud-aiplatform` |

### 핵심 차이점

- **Basic (v2)**: Google 번역과 동일한 NMT 엔진. 빠르고 저렴. 단순 번역에 최적.
- **Advanced (v3)**: NMT + LLM 선택 가능. 용어집, 배치 번역, 커스텀 모델 지원.
- **Vertex AI Translation**: Gemini 기반 번역 LLM. 가장 자연스러운 번역. 커스텀 예시로 미세 조정 가능.

---

## 2. 상세 비교표

| 항목 | Basic (v2) | Advanced (v3) | Vertex AI Translation |
|------|-----------|--------------|----------------------|
| **번역 엔진** | NMT | NMT + 번역 LLM | 번역 LLM + NMT |
| **지원 언어** | 130+ | 130+ (NMT) / 20+ (LLM) | 20+ (LLM) / 130+ (NMT) |
| **응답 속도** | ~50ms | ~50ms (NMT) / ~200ms (LLM) | ~200-500ms |
| **번역 품질** | 좋음 | 좋음~우수 | 우수 (가장 자연스러움) |
| **용어집** | ❌ | ✅ | ❌ (커스텀 예시로 대체) |
| **배치 번역** | ❌ | ✅ | ✅ |
| **문서 번역** | ❌ | ✅ (DOCX, PDF, PPTX, XLSX) | ❌ |
| **커스텀 모델** | ❌ | ✅ (AutoML Translation) | ✅ (인라인 예시) |
| **언어 감지** | ✅ | ✅ | ✅ |
| **로마자 변환** | ❌ | ✅ | ❌ |
| **HTML 지원** | ✅ | ✅ | ❌ |
| **인증** | API 키 또는 서비스 계정 | 서비스 계정 | 서비스 계정 |
| **무료 할당량** | 월 50만 자 (매월 $10 크레딧) | 매월 $10 크레딧 (Basic과 합산) | 없음 |

---

## 3. Cloud Translation - Basic (v2)

### 특징
- Google 사전 학습 **인공신경망 기계 번역(NMT)** 모델 사용
- **가장 빠른** 응답 속도 (~50ms)
- **130개 이상** 언어 지원
- 간단한 REST API, API 키 인증 지원
- 채팅, 소셜 미디어, 사용자 제작 콘텐츠에 적합

### 장점
- 설정이 매우 간단 (API 키만 있으면 됨)
- 응답 속도가 가장 빠름
- 무료 할당량 제공 (월 50만 자, $10 크레딧)
- 자동 언어 감지 (추가 비용 없음)

### 단점
- 용어집, 배치 번역 미지원
- 커스텀 모델 미지원
- 문맥을 고려한 번역이 약함
- 새로운 기능 추가 계획 없음 (Google은 Advanced 사용 권장)

### 가격
| 사용량 | 가격 |
|--------|------|
| 월 50만 자 이하 | **무료** ($10 크레딧) |
| 50만 자 초과 | **$20 / 100만 자** |

### Python SDK (v2)
```python
from google.cloud import translate_v2 as translate

client = translate.Client()

# 텍스트 번역
result = client.translate(
    "Hello, how are you?",
    target_language="ko",
    format_="text",  # 또는 "html"
)
print(result["translatedText"])  # "안녕하세요, 잘 지내세요?"
print(result["detectedSourceLanguage"])  # "en"

# 언어 감지
detection = client.detect_language("こんにちは")
print(detection["language"])  # "ja"
print(detection["confidence"])  # 0.99

# 지원 언어 목록
languages = client.get_languages()
for lang in languages:
    print(f"{lang['language']}: {lang.get('name', 'N/A')}")
```

### REST API
```bash
# 번역
curl -X POST \
  "https://translation.googleapis.com/language/translate/v2?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "q": "Hello, how are you?",
    "target": "ko",
    "format": "text"
  }'

# 언어 감지
curl -X POST \
  "https://translation.googleapis.com/language/translate/v2/detect?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q": "こんにちは"}'
```

---

## 4. Cloud Translation - Advanced (v3)

### 특징
- NMT 모델 + **번역 LLM** (Gemini 기반 미세 조정 모델) 선택 가능
- **용어집(Glossary)**: 특정 용어를 항상 같은 번역으로 고정
- **배치 번역**: 대량 텍스트를 Cloud Storage에서 일괄 처리
- **문서 번역**: DOCX, PDF, PPTX, XLSX 파일 번역
- **적응형 번역**: 예시 번역 데이터로 스타일 학습
- **커스텀 모델**: AutoML Translation으로 도메인 특화 모델 학습 가능

### 장점
- 모든 기능을 하나의 API로 제공 (NMT + LLM)
- 용어집으로 일관된 번역 보장
- 배치 번역으로 대량 처리 가능
- AutoML로 도메인 특화 가능
- Google이 **공식 권장하는 버전**

### 단점
- Basic보다 설정이 복잡 (프로젝트 ID, 위치 지정 필요)
- API 키 인증 불가 (서비스 계정 필수)
- LLM 모델의 지원 언어가 NMT보다 적음 (~20개)

### 가격

#### NMT 모델 (기본)
| 사용량 | 가격 |
|--------|------|
| 월 50만 자 이하 | **무료** ($10 크레딧, Basic과 합산) |
| NMT 텍스트 번역 | **$20 / 100만 자** |
| NMT 배치 번역 | **$20 / 100만 자** |
| 문서 번역 | **$0.15 / 페이지** (페이지당 최대 4,000자) |

#### 번역 LLM (고품질)
| 기능 | 가격 |
|------|------|
| LLM 텍스트 번역 (입력) | **$10 / 100만 자** |
| LLM 텍스트 번역 (출력) | **$10 / 100만 자** |
| 적응형 번역 (입력) | **$25 / 100만 자** |
| 적응형 번역 (출력) | **$25 / 100만 자** |

#### AutoML 커스텀 모델
| 항목 | 가격 |
|------|------|
| 모델 학습 | **$76 / 시간** |
| 번역 (0~50만 자) | **무료** |
| 번역 (50만~2.5억 자) | **$80 / 100만 자** |
| 번역 (2.5억~25억 자) | **$60 / 100만 자** |
| 번역 (25억~40억 자) | **$40 / 100만 자** |
| 번역 (40억 자 초과) | **$30 / 100만 자** |

### Python SDK (v3)
```python
import os
from google.cloud import translate_v3

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")

# 클라이언트 초기화
client = translate_v3.TranslationServiceClient()
parent = f"projects/{PROJECT_ID}/locations/global"

# === 기본 텍스트 번역 (NMT) ===
response = client.translate_text(
    contents=["Hello, how are you?"],
    parent=parent,
    mime_type="text/plain",
    source_language_code="en",
    target_language_code="ko",
)
for translation in response.translations:
    print(translation.translated_text)

# === 번역 LLM 사용 ===
response = client.translate_text(
    contents=["The early bird catches the worm"],
    parent=parent,
    mime_type="text/plain",
    source_language_code="en",
    target_language_code="ko",
    model=f"projects/{PROJECT_ID}/locations/global/models/general/translation-llm",
)
for translation in response.translations:
    print(translation.translated_text)

# === 용어집 사용 ===
glossary_id = "my-glossary"
glossary_path = f"projects/{PROJECT_ID}/locations/us-central1/glossaries/{glossary_id}"

glossary_config = translate_v3.TranslateTextGlossaryConfig(glossary=glossary_path)
response = client.translate_text(
    contents=["The API returns a response"],
    parent=f"projects/{PROJECT_ID}/locations/us-central1",
    mime_type="text/plain",
    source_language_code="en",
    target_language_code="ko",
    glossary_config=glossary_config,
)
for translation in response.glossary_translations:
    print(translation.translated_text)

# === 언어 감지 ===
response = client.detect_language(
    parent=parent,
    content="こんにちは世界",
    mime_type="text/plain",
)
for language in response.languages:
    print(f"Language: {language.language_code}, Confidence: {language.confidence}")

# === 배치 번역 ===
input_config = translate_v3.InputConfig(
    gcs_source=translate_v3.GcsSource(input_uri="gs://my-bucket/input.txt"),
    mime_type="text/plain",
)
output_config = translate_v3.OutputConfig(
    gcs_destination=translate_v3.GcsDestination(output_uri_prefix="gs://my-bucket/output/"),
)
operation = client.batch_translate_text(
    parent=f"projects/{PROJECT_ID}/locations/us-central1",
    source_language_code="en",
    target_language_codes=["ko", "ja"],
    input_configs=[input_config],
    output_config=output_config,
)
result = operation.result()  # 비동기 작업 완료 대기
print(f"Translated {result.total_characters} characters")
```

### REST API
```bash
# NMT 번역
curl -X POST \
  "https://translation.googleapis.com/v3/projects/PROJECT_ID/locations/global:translateText" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceLanguageCode": "en",
    "targetLanguageCode": "ko",
    "contents": ["Hello, how are you?"],
    "mimeType": "text/plain"
  }'

# 번역 LLM 사용
curl -X POST \
  "https://translation.googleapis.com/v3/projects/PROJECT_ID/locations/global:translateText" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceLanguageCode": "en",
    "targetLanguageCode": "ko",
    "contents": ["The early bird catches the worm"],
    "mimeType": "text/plain",
    "model": "projects/PROJECT_ID/locations/global/models/general/translation-llm"
  }'
```

---

## 5. Vertex AI Translation (번역 LLM)

### 특징
- **Gemini 파운데이션 모델에서 미세 조정**된 번역 전용 LLM
- 다른 번역 모델 대비 벤치마크에서 **가장 높은 품질**
- 관용구, 속담 등 **자연스러운 의역** 능력이 뛰어남
- Vertex AI Studio에서 **대화형 테스트** 가능
- **커스텀 번역**: 예시 번역 데이터(최대 5쌍)로 인라인 미세 조정

### 장점
- 가장 자연스러운 번역 품질 (특히 관용어/속담)
- "단어 대 단어" 직역 대신 자연스러운 의역
- 인라인 예시로 간단하게 커스터마이징
- Vertex AI Studio에서 빠르게 프로토타이핑 가능

### 단점
- 지원 언어가 적음 (~20개, NMT는 130+)
- NMT보다 응답 시간 길음 (~200-500ms)
- Vertex AI 설정 필요 (더 복잡한 인프라)
- 용어집 미지원 (인라인 예시로 대체)
- 별도 가격 체계 (Vertex AI 과금)

### 지원 언어 (번역 LLM)
아랍어, 중국어(간체/번체), 체코어, 네덜란드어, 영어, 프랑스어, 독일어, 힌디어, 
인도네시아어, 이탈리아어, 일본어, 한국어, 폴란드어, 포르투갈어, 러시아어, 
스페인어, 태국어, 터키어, 우크라이나어, 베트남어

### 가격
Vertex AI 예측 API 가격 기준:
| 항목 | 가격 |
|------|------|
| 입력 문자 | **$10 / 100만 자** |
| 출력 문자 | **$10 / 100만 자** |

> ⚠️ Vertex AI 플랫폼 사용료가 별도로 발생할 수 있음

### Python SDK
```python
from google.cloud import aiplatform

PROJECT_ID = "your-project-id"
LOCATION = "us-central1"

def translate_with_vertex_ai(
    text: str,
    source_lang: str = "en",
    target_lang: str = "ko",
):
    """Vertex AI Translation LLM으로 번역"""
    client_options = {"api_endpoint": f"{LOCATION}-aiplatform.googleapis.com"}
    client = aiplatform.gapic.PredictionServiceClient(
        client_options=client_options
    )
    
    endpoint_id = (
        f"projects/{PROJECT_ID}/locations/{LOCATION}"
        f"/publishers/google/models/cloud-translate-text"
    )
    
    instances = [{
        "model": f"projects/{PROJECT_ID}/locations/{LOCATION}/models/general/translation-llm",
        "source_language_code": source_lang,
        "target_language_code": target_lang,
        "contents": [text],
    }]
    
    response = client.predict(instances=instances, endpoint=endpoint_id)
    return response.predictions


# --- 커스텀 번역 (인라인 예시 제공) ---
def translate_custom(text: str):
    """예시 번역을 제공하여 스타일 학습"""
    client_options = {"api_endpoint": f"{LOCATION}-aiplatform.googleapis.com"}
    client = aiplatform.gapic.PredictionServiceClient(
        client_options=client_options
    )
    
    endpoint_id = (
        f"projects/{PROJECT_ID}/locations/{LOCATION}"
        f"/publishers/google/models/cloud-translate-text"
    )
    
    instances = [{
        "model": f"projects/{PROJECT_ID}/locations/{LOCATION}/models/general/translation-llm",
        "source_language_code": "en",
        "target_language_code": "ko",
        "contents": ["That's a piece of cake!"],
        # 최대 5쌍의 예시로 번역 스타일 학습
        "reference_sentence_pair_lists": [{
            "reference_sentence_pairs": [
                {
                    "source_sentence": "Break a leg!",
                    "target_sentence": "행운을 빌어!"
                },
                {
                    "source_sentence": "It's raining cats and dogs",
                    "target_sentence": "비가 억수같이 쏟아지네"
                }
            ]
        }]
    }]
    
    response = client.predict(instances=instances, endpoint=endpoint_id)
    return response.predictions
```

### REST API
```bash
# 번역 LLM
curl -X POST \
  "https://us-central1-aiplatform.googleapis.com/v1/projects/PROJECT_ID/locations/us-central1/publishers/google/models/cloud-translate-text:predict" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "instances": [{
      "model": "projects/PROJECT_ID/locations/us-central1/models/general/translation-llm",
      "source_language_code": "en",
      "target_language_code": "ko",
      "contents": ["Break a leg!"]
    }]
  }'

# NMT 모델 (Vertex AI 경유)
curl -X POST \
  "https://us-central1-aiplatform.googleapis.com/v1/projects/PROJECT_ID/locations/us-central1/publishers/google/models/cloud-translate-text:predict" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "instances": [{
      "model": "projects/PROJECT_ID/locations/us-central1/models/general/nmt",
      "source_language_code": "en",
      "target_language_code": "ko",
      "contents": ["Hello world"]
    }]
  }'
```

---

## 6. 가격 비교

### 동일 조건 시뮬레이션: 월 100만 자 번역 시

| 제품 | 월 비용 | 비고 |
|------|--------|------|
| **Basic (v2)** | **$10** | 50만 자 무료 + 50만 자 × $20/M |
| **Advanced (v3) - NMT** | **$10** | 50만 자 무료 + 50만 자 × $20/M |
| **Advanced (v3) - LLM** | **$20** | 입력 $10/M + 출력 $10/M |
| **Vertex AI - LLM** | **$20** | 입력 $10/M + 출력 $10/M |

### 대규모 사용 시: 월 1억 자 번역 시

| 제품 | 월 비용 |
|------|--------|
| **Basic (v2)** | **~$2,000** |
| **Advanced (v3) - NMT** | **~$2,000** |
| **Advanced (v3) - LLM** | **~$2,000** (입+출) |
| **Vertex AI - LLM** | **~$2,000** + 플랫폼 비용 |

> 💡 **결론**: 가격은 거의 동일. NMT와 LLM 모두 100만 자당 $20 수준. 차이점은 **기능과 품질**.

---

## 7. 커스터마이징 비교

### 7.1 용어집 (Glossary)

**지원**: Advanced (v3)만 지원

특정 용어를 항상 일관되게 번역. 예를 들어:
- "API" → "API" (번역하지 않음)
- "session" → "세션" (항상 동일하게)
- "My Turn" → "마이턴" (서비스 용어 고정)

```python
# 용어집 생성 (Cloud Translation v3)
from google.cloud import translate_v3

client = translate_v3.TranslationServiceClient()
parent = f"projects/{PROJECT_ID}/locations/us-central1"

# GCS에 TSV 파일 업로드 필요 (en\tko 형식)
glossary = translate_v3.Glossary(
    name=f"{parent}/glossaries/my-english-glossary",
    language_pair=translate_v3.Glossary.LanguageCodePair(
        source_language_code="en",
        target_language_code="ko",
    ),
    input_config=translate_v3.GlossaryInputConfig(
        gcs_source=translate_v3.GcsSource(
            input_uri="gs://my-bucket/glossary.tsv"
        ),
    ),
)

operation = client.create_glossary(parent=parent, glossary=glossary)
result = operation.result()
```

### 7.2 AutoML Translation (커스텀 모델)

**지원**: Advanced (v3)만 지원

자체 번역 데이터로 도메인 특화 번역 모델 학습:
- 의료, 법률, 기술 등 전문 분야
- 최소 학습 데이터: 1,000 문장 쌍 (권장: 10,000+)
- 학습 비용: **$76/시간**

### 7.3 커스텀 번역 (인라인 예시)

**지원**: Vertex AI Translation만 지원

번역 요청에 최대 **5쌍의 예시**를 포함하여 실시간으로 스타일 조정:
- 별도 모델 학습 불필요
- 요청마다 다른 스타일 적용 가능
- TMX/TSV 파일로 더 많은 예시 제공 가능 (콘솔에서)

### 7.4 적응형 번역 (Adaptive Translation)

**지원**: Advanced (v3)

번역 데이터셋을 기반으로 번역 스타일을 실시간 적응:
- 용어집보다 유연하고, 커스텀 모델보다 간단
- 예시 데이터를 API 호출 시 참조
- 가격: **$25/100만 자** (일반 번역의 2.5배)

### 커스터마이징 비교 요약

| 방법 | Basic (v2) | Advanced (v3) | Vertex AI |
|------|-----------|--------------|-----------|
| **용어집** | ❌ | ✅ | ❌ |
| **AutoML 모델** | ❌ | ✅ ($76/h 학습) | ❌ |
| **적응형 번역** | ❌ | ✅ ($25/M자) | ❌ |
| **인라인 예시** | ❌ | ❌ | ✅ (최대 5쌍) |
| **TMX/TSV 예시** | ❌ | ❌ | ✅ (콘솔) |
| **프롬프트 제어** | ❌ | ❌ | ❌ |

---

## 8. API 사용법

### 8.1 인증 방식

| 제품 | API 키 | 서비스 계정 | Cloud Run 자동 인증 |
|------|--------|-----------|-------------------|
| **Basic (v2)** | ✅ | ✅ | ✅ |
| **Advanced (v3)** | ❌ | ✅ | ✅ |
| **Vertex AI** | ❌ | ✅ | ✅ |

> Cloud Run에서는 3가지 모두 **별도 인증 설정 없이** 기본 서비스 계정으로 동작합니다.

### 8.2 필요한 Python 패키지

```toml
# pyproject.toml
[tool.poetry.dependencies]
# Basic (v2) + Advanced (v3) — 같은 패키지
google-cloud-translate = "^3.18.0"

# Vertex AI Translation
google-cloud-aiplatform = "^1.40.0"
```

### 8.3 필요한 GCP API 활성화

```bash
# Cloud Translation API (Basic + Advanced 모두)
gcloud services enable translate.googleapis.com --project=PROJECT_ID

# Vertex AI API (Vertex AI Translation만)
gcloud services enable aiplatform.googleapis.com --project=PROJECT_ID
```

### 8.4 필요한 IAM 역할

| 제품 | 필요 역할 |
|------|----------|
| **Basic (v2)** | `roles/cloudtranslate.user` |
| **Advanced (v3)** | `roles/cloudtranslate.user` |
| **Vertex AI** | `roles/aiplatform.user` |

---

## 9. 우리 서비스 최적 제품 분석

### 9.1 서비스 요구사항

우리 서비스(Study English)의 번역 사용 시나리오:

| 시나리오 | 설명 | 빈도 |
|---------|------|------|
| **실시간 대화 번역** | AI 발화를 한국어로 즉시 번역 | 매우 높음 |
| **단문 번역** | 한 문장씩 번역 (평균 5-30 단어) | 매우 높음 |
| **영→한 단방향** | 영어 → 한국어 고정 | 100% |
| **학습 용어 일관성** | 특정 학습 용어 통일 필요 | 중간 |

### 9.2 지표별 비교 (우리 서비스 기준)

| 지표 | 가중치 | Basic (v2) | Advanced (v3) NMT | Advanced (v3) LLM | Vertex AI |
|------|--------|-----------|-------------------|-------------------|-----------|
| **응답 속도** | ⭐⭐⭐ | 🟢 ~50ms | 🟢 ~50ms | 🟡 ~200ms | 🔴 ~500ms |
| **번역 품질** | ⭐⭐⭐ | 🟡 좋음 | 🟡 좋음 | 🟢 우수 | 🟢 우수 |
| **설정 난이도** | ⭐⭐ | 🟢 매우 쉬움 | 🟡 보통 | 🟡 보통 | 🔴 복잡 |
| **가격** | ⭐⭐ | 🟢 $20/M | 🟢 $20/M | 🟡 $20/M (입+출) | 🟡 $20/M + α |
| **용어집** | ⭐ | 🔴 미지원 | 🟢 지원 | 🟢 지원 | 🔴 미지원 |
| **한국어 지원** | ⭐⭐⭐ | 🟢 지원 | 🟢 지원 | 🟢 지원 | 🟢 지원 |
| **Cloud Run 호환** | ⭐⭐⭐ | 🟢 완벽 | 🟢 완벽 | 🟢 완벽 | 🟢 완벽 |

### 9.3 추천 전략

#### 🏆 현재 최적: **Cloud Translation - Basic (v2)** ← 현재 적용 중

**이유:**
1. **속도 최우선**: 실시간 대화 중 번역이므로 ~50ms가 가장 중요
2. **단문 번역**: 한 문장씩 번역하므로 LLM의 맥락 이해 장점이 크지 않음
3. **설정 간단**: API 키 또는 서비스 계정으로 즉시 사용
4. **비용 효율**: 가장 저렴하고 무료 할당량 제공

#### 🔮 미래 업그레이드 시나리오

| 시나리오 | 추천 | 이유 |
|---------|------|------|
| 번역 품질 불만 (관용어/속담) | Advanced (v3) LLM | 자연스러운 의역 |
| 학습 용어 통일 필요 | Advanced (v3) + 용어집 | "session"→"세션" 고정 |
| 학습 자료 대량 번역 | Advanced (v3) 배치 | GCS 기반 일괄 처리 |
| 최고 품질 + 커스텀 | Vertex AI | 인라인 예시로 자연스러운 학습 문맥 번역 |

---

## 10. 마이그레이션 가이드

### Basic (v2) → Advanced (v3) 전환 시

```python
# BEFORE: Basic (v2)
from google.cloud import translate_v2 as translate
client = translate.Client()
result = client.translate("Hello", target_language="ko")
print(result["translatedText"])

# AFTER: Advanced (v3) - NMT
from google.cloud import translate_v3
client = translate_v3.TranslationServiceClient()
response = client.translate_text(
    contents=["Hello"],
    parent=f"projects/{PROJECT_ID}/locations/global",
    mime_type="text/plain",
    target_language_code="ko",
)
print(response.translations[0].translated_text)

# AFTER: Advanced (v3) - 번역 LLM
response = client.translate_text(
    contents=["Hello"],
    parent=f"projects/{PROJECT_ID}/locations/global",
    mime_type="text/plain",
    target_language_code="ko",
    model=f"projects/{PROJECT_ID}/locations/global/models/general/translation-llm",
)
print(response.translations[0].translated_text)
```

### 코드 변경 최소화 팁

우리 서비스의 `router.py`에서 전환하려면:

```python
# 현재 (Basic v2) — 변경 불필요
from google.cloud import translate_v2 as translate
client = translate.Client()
result = client.translate(text, target_language=target_lang, format_="text")
translated = result["translatedText"]

# 나중에 v3 LLM으로 전환 시
from google.cloud import translate_v3
client = translate_v3.TranslationServiceClient()
response = client.translate_text(
    contents=[text],
    parent=f"projects/{PROJECT_ID}/locations/global",
    target_language_code=target_lang,
    model=f"projects/{PROJECT_ID}/locations/global/models/general/translation-llm",
)
translated = response.translations[0].translated_text
```

---

## 📚 참고 문서 링크

| 문서 | URL |
|------|-----|
| Cloud Translation 개요 | https://cloud.google.com/translate/docs/overview |
| Cloud Translation 가격 | https://cloud.google.com/translate/pricing |
| Basic (v2) 빠른 시작 | https://cloud.google.com/translate/docs/basic/translating-text |
| Advanced (v3) 빠른 시작 | https://cloud.google.com/translate/docs/advanced/translating-text-v3 |
| 용어집 만들기 | https://cloud.google.com/translate/docs/advanced/glossary |
| 적응형 번역 | https://cloud.google.com/translate/docs/advanced/adaptive-translation |
| AutoML Translation | https://cloud.google.com/translate/docs/advanced/automl-beginner |
| Vertex AI Translation | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/translate/translate-text |
| 지원 언어 목록 | https://cloud.google.com/translate/docs/languages |
| Python SDK 레퍼런스 | https://cloud.google.com/python/docs/reference/translate/latest |

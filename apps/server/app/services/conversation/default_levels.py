"""Default level definitions for Narrative Sync pipeline."""

# 기본 10단계 정의 — TemplateEditor 안내와 동일하게 유지합니다.
DEFAULT_LEVEL_DEFINITIONS = [
    {
        "level": 1,
        "name": "기본 SVO",
        "description": "Simple Subject-Verb-Object sentences",
        "instruction": "Use only simple SVO sentences. Example: 'I wake up. I eat breakfast. I feel good.'",
    },
    {
        "level": 2,
        "name": "시간/장소 추가",
        "description": "Add time and place expressions",
        "instruction": "Add time/place to sentences. Example: 'I wake up at 7. I eat breakfast in the kitchen.'",
    },
    {
        "level": 3,
        "name": "형용사 추가",
        "description": "Add adjectives to nouns",
        "instruction": "Add adjectives to describe nouns. Example: 'I drink hot coffee. I eat a big breakfast.'",
    },
    {
        "level": 4,
        "name": "부사 추가",
        "description": "Add adverbs to verbs",
        "instruction": "Add adverbs to describe actions. Example: 'I slowly wake up. I carefully make breakfast.'",
    },
    {
        "level": 5,
        "name": "접속사 (and/but/so)",
        "description": "Connect sentences with basic conjunctions",
        "instruction": "Connect ideas with and/but/so. Example: 'I wake up and stretch. I eat, but I'm still tired.'",
    },
    {
        "level": 6,
        "name": "복문 (because/when/if)",
        "description": "Use subordinate clauses",
        "instruction": "Use because/when/if clauses. Example: 'When I wake up, I feel tired because I slept late.'",
    },
    {
        "level": 7,
        "name": "구동사",
        "description": "Use phrasal verbs",
        "instruction": "Use phrasal verbs naturally. Example: 'I get up early. I look forward to breakfast.'",
    },
    {
        "level": 8,
        "name": "비유/관용표현",
        "description": "Use idioms and figurative language",
        "instruction": "Use idioms and figurative expressions. Example: 'I feel like a million bucks after my morning jog.'",
    },
    {
        "level": 9,
        "name": "복합 시제",
        "description": "Use advanced tenses",
        "instruction": "Use past perfect, conditionals, etc. Example: 'I had been sleeping until my alarm went off.'",
    },
    {
        "level": 10,
        "name": "원어민 수준",
        "description": "Native-level fluency with mixed structures",
        "instruction": "Mix all structures freely with natural flow. Vary sentence length, use transitions, show personality.",
    },
]


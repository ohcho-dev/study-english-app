"""초기 접근 제어 데이터 세팅 스크립트.

사용법:
    cd apps/server
    poetry run python -m scripts.init_access_control
"""

import asyncio
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

import bcrypt
from sqlalchemy import select, text

from app.core.database import AsyncSessionLocal, engine
from app.models.base import Base
from app.models.account import Account, PagePermission

# 기본 admin 비밀번호 (첫 로그인 후 변경 권장)
DEFAULT_ADMIN_PASSWORD = "admin123"

# 페이지 시드 데이터
PAGE_SEEDS = [
    ("/", "대시보드", "홈"),
    ("/lab/variables", "변수 관리", "🧪 실험실"),
    ("/lab/prompts", "AI 프롬프트", "🧪 실험실"),
    ("/lab/analytics", "분석 대시보드", "🧪 실험실"),
    ("/ai-lab/pipelines", "파이프라인", "🤖 AI Agent Lab"),
    ("/ai-lab/experiment", "실험 테스트", "🤖 AI Agent Lab"),
    ("/ai-lab/logs", "실험 로그", "🤖 AI Agent Lab"),
    ("/conversations/templates", "템플릿 관리", "🎙️ 대화 시나리오"),
    ("/conversations/run0", "Latency Lab (Run0)", "🎙️ 대화 시나리오"),
    ("/conversations/my-turn", "My Turn (시나리오)", "🎙️ 대화 시나리오"),
    ("/conversations/sessions", "세션 기록", "🎙️ 대화 시나리오"),
    ("/contents/scenarios", "시나리오 관리", "📦 콘텐츠"),
    ("/settings/themes", "테마 관리", "⚙️ 앱관리"),
    ("/settings/users", "사용자 관리", "⚙️ 앱관리"),
    ("/settings/access-control", "접근 제어", "⚙️ 앱관리"),
]


async def init():
    # 1. 새 테이블 생성 (accounts, page_permissions)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ 테이블 생성/확인 완료")

    # 2. 기존 테이블에 컬럼 추가 (conversation_templates.is_public_to_tester)
    async with engine.begin() as conn:
        try:
            await conn.execute(text(
                "ALTER TABLE conversation_templates ADD COLUMN IF NOT EXISTS is_public_to_tester BOOLEAN NOT NULL DEFAULT false"
            ))
            print("✅ conversation_templates.is_public_to_tester 컬럼 추가")
        except Exception as e:
            print(f"ℹ️  컬럼 추가 스킵: {e}")

    async with AsyncSessionLocal() as db:
        # 3. Admin 계정 확인/생성
        result = await db.execute(
            select(Account).where(Account.username == "admin")
        )
        existing = result.scalar_one_or_none()

        if not existing:
            password_hash = bcrypt.hashpw(
                DEFAULT_ADMIN_PASSWORD.encode("utf-8"),
                bcrypt.gensalt(),
            ).decode("utf-8")

            admin = Account(
                username="admin",
                password_hash=password_hash,
                display_name="Admin",
                role="admin",
            )
            db.add(admin)
            print(f"✅ Admin 계정 생성 (username: admin, password: {DEFAULT_ADMIN_PASSWORD})")
        else:
            print("ℹ️  Admin 계정 이미 존재")

        # 4. 페이지 권한 시드
        result = await db.execute(select(PagePermission))
        existing_perms = result.scalars().all()
        existing_paths = {p.route_path for p in existing_perms}

        added = 0
        for path, name, group in PAGE_SEEDS:
            if path not in existing_paths:
                db.add(PagePermission(
                    route_path=path,
                    route_name=name,
                    route_group=group,
                    is_public_to_tester=False,
                ))
                added += 1

        if added:
            print(f"✅ 페이지 권한 {added}개 추가")
        else:
            print("ℹ️  페이지 권한 이미 존재")

        await db.commit()

    print("\n🎉 초기화 완료!")


if __name__ == "__main__":
    asyncio.run(init())

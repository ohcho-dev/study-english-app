"""Authentication and account management service."""

import logging
from uuid import UUID

import bcrypt
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.account import Account, PagePermission
from app.models.conversation import ConversationTemplate

logger = logging.getLogger(__name__)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


class AuthService:
    """인증 및 계정 관리 서비스."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # -----------------------------------------------------------
    # Authentication
    # -----------------------------------------------------------

    async def authenticate(self, username: str, password: str) -> Account | None:
        """로그인 — 검증 성공 시 Account 반환, 실패 시 None."""
        result = await self.db.execute(
            select(Account).where(Account.username == username, Account.is_active == True)  # noqa: E712
        )
        account = result.scalar_one_or_none()

        if not account or not _verify_password(password, account.password_hash):
            return None

        return account

    def create_token(self, account: Account) -> str:
        """JWT 토큰 생성 (role 포함)."""
        return create_access_token(
            data={
                "sub": str(account.id),
                "username": account.username,
                "role": account.role,
            }
        )

    async def get_account_by_id(self, account_id: UUID) -> Account | None:
        """ID로 계정 조회."""
        result = await self.db.execute(
            select(Account).where(Account.id == account_id)
        )
        return result.scalar_one_or_none()

    # -----------------------------------------------------------
    # Permissions
    # -----------------------------------------------------------

    async def get_allowed_routes(self, role: str) -> list[str]:
        """역할별 허용된 페이지 경로 목록."""
        if role == "admin":
            result = await self.db.execute(select(PagePermission.route_path))
            return [r[0] for r in result.all()]

        # tester: is_public_to_tester = True 인 페이지만
        result = await self.db.execute(
            select(PagePermission.route_path).where(
                PagePermission.is_public_to_tester == True  # noqa: E712
            )
        )
        return [r[0] for r in result.all()]

    async def get_all_permissions(self) -> list[PagePermission]:
        """모든 페이지 권한 목록."""
        result = await self.db.execute(
            select(PagePermission).order_by(PagePermission.route_group, PagePermission.route_path)
        )
        return list(result.scalars().all())

    async def update_permissions(self, updates: list[dict]) -> None:
        """페이지 권한 일괄 업데이트.
        
        Args:
            updates: [{"id": uuid, "is_public_to_tester": bool}, ...]
        """
        for item in updates:
            await self.db.execute(
                update(PagePermission)
                .where(PagePermission.id == item["id"])
                .values(is_public_to_tester=item["is_public_to_tester"])
            )
        await self.db.commit()

    # -----------------------------------------------------------
    # Account CRUD (admin only)
    # -----------------------------------------------------------

    async def list_accounts(self) -> list[Account]:
        """모든 계정 목록."""
        result = await self.db.execute(
            select(Account).order_by(Account.role, Account.username)
        )
        return list(result.scalars().all())

    async def create_account(
        self,
        username: str,
        password: str,
        display_name: str | None = None,
        role: str = "tester",
    ) -> Account:
        """새 계정 생성."""
        account = Account(
            username=username,
            password_hash=_hash_password(password),
            display_name=display_name,
            role=role,
        )
        self.db.add(account)
        await self.db.commit()
        await self.db.refresh(account)
        logger.info(f"[AuthService] Created account: {username} (role={role})")
        return account

    async def delete_account(self, account_id: UUID) -> bool:
        """계정 삭제."""
        result = await self.db.execute(
            select(Account).where(Account.id == account_id)
        )
        account = result.scalar_one_or_none()
        if not account:
            return False

        if account.role == "admin":
            # admin 계정은 삭제 불가
            return False

        await self.db.delete(account)
        await self.db.commit()
        logger.info(f"[AuthService] Deleted account: {account.username}")
        return True

    async def change_password(self, account_id: UUID, new_password: str) -> bool:
        """비밀번호 변경."""
        result = await self.db.execute(
            select(Account).where(Account.id == account_id)
        )
        account = result.scalar_one_or_none()
        if not account:
            return False

        account.password_hash = _hash_password(new_password)
        await self.db.commit()
        logger.info(f"[AuthService] Changed password: {account.username}")
        return True

    # -----------------------------------------------------------
    # Template Visibility
    # -----------------------------------------------------------

    async def get_templates_visibility(self) -> list[dict]:
        """템플릿별 공개 여부 목록."""
        result = await self.db.execute(
            select(
                ConversationTemplate.id,
                ConversationTemplate.name,
                ConversationTemplate.is_public_to_tester,
            )
            .where(ConversationTemplate.is_active == True)  # noqa: E712
            .order_by(ConversationTemplate.name)
        )
        return [
            {"id": str(r.id), "name": r.name, "is_public_to_tester": r.is_public_to_tester}
            for r in result.all()
        ]

    async def update_templates_visibility(self, updates: list[dict]) -> None:
        """템플릿 공개 여부 일괄 업데이트.
        
        Args:
            updates: [{"id": uuid, "is_public_to_tester": bool}, ...]
        """
        for item in updates:
            await self.db.execute(
                update(ConversationTemplate)
                .where(ConversationTemplate.id == item["id"])
                .values(is_public_to_tester=item["is_public_to_tester"])
            )
        await self.db.commit()

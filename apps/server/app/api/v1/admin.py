"""Admin API endpoints — 계정/권한 관리 (admin 전용)."""

import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from uuid import UUID

from app.api.deps import AdminAccount, DbSession
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


# -----------------------------------------------------------
# Schemas
# -----------------------------------------------------------

class AccountResponse(BaseModel):
    id: str
    username: str
    display_name: str | None
    role: str
    is_active: bool


class CreateAccountRequest(BaseModel):
    username: str
    password: str
    display_name: str | None = None


class ChangePasswordRequest(BaseModel):
    new_password: str


class PermissionResponse(BaseModel):
    id: str
    route_path: str
    route_name: str
    route_group: str | None
    is_public_to_tester: bool


class PermissionUpdateItem(BaseModel):
    id: str
    is_public_to_tester: bool


class PermissionsUpdateRequest(BaseModel):
    permissions: list[PermissionUpdateItem]


class TemplateVisibilityItem(BaseModel):
    id: str
    name: str
    is_public_to_tester: bool


class TemplateVisibilityUpdateItem(BaseModel):
    id: str
    is_public_to_tester: bool


class TemplateVisibilityUpdateRequest(BaseModel):
    templates: list[TemplateVisibilityUpdateItem]


# -----------------------------------------------------------
# Account CRUD
# -----------------------------------------------------------

@router.get("/accounts", response_model=list[AccountResponse])
async def list_accounts(db: DbSession, _admin: AdminAccount):
    """계정 목록 조회 (admin 전용)."""
    service = AuthService(db)
    accounts = await service.list_accounts()
    return [
        AccountResponse(
            id=str(a.id),
            username=a.username,
            display_name=a.display_name,
            role=a.role,
            is_active=a.is_active,
        )
        for a in accounts
    ]


@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(db: DbSession, _admin: AdminAccount, data: CreateAccountRequest):
    """테스터 계정 생성 (admin 전용)."""
    service = AuthService(db)

    try:
        account = await service.create_account(
            username=data.username,
            password=data.password,
            display_name=data.display_name,
            role="tester",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{data.username}' already exists",
        )

    return AccountResponse(
        id=str(account.id),
        username=account.username,
        display_name=account.display_name,
        role=account.role,
        is_active=account.is_active,
    )


@router.put("/accounts/{account_id}/password")
async def change_password(db: DbSession, _admin: AdminAccount, account_id: UUID, data: ChangePasswordRequest):
    """비밀번호 변경 (admin 전용)."""
    service = AuthService(db)
    changed = await service.change_password(account_id, data.new_password)

    if not changed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    return {"success": True}


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(db: DbSession, _admin: AdminAccount, account_id: UUID):
    """계정 삭제 (admin 전용, admin 계정은 삭제 불가)."""
    service = AuthService(db)
    deleted = await service.delete_account(account_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete this account (not found or is admin)",
        )


# -----------------------------------------------------------
# Page Permissions
# -----------------------------------------------------------

@router.get("/permissions", response_model=list[PermissionResponse])
async def list_permissions(db: DbSession, _admin: AdminAccount):
    """페이지 권한 목록 (admin 전용)."""
    service = AuthService(db)
    permissions = await service.get_all_permissions()
    return [
        PermissionResponse(
            id=str(p.id),
            route_path=p.route_path,
            route_name=p.route_name,
            route_group=p.route_group,
            is_public_to_tester=p.is_public_to_tester,
        )
        for p in permissions
    ]


@router.put("/permissions")
async def update_permissions(db: DbSession, _admin: AdminAccount, data: PermissionsUpdateRequest):
    """페이지 권한 일괄 업데이트 (admin 전용)."""
    service = AuthService(db)
    await service.update_permissions(
        [{"id": UUID(p.id), "is_public_to_tester": p.is_public_to_tester} for p in data.permissions]
    )
    return {"success": True}


# -----------------------------------------------------------
# Template Visibility
# -----------------------------------------------------------

@router.get("/templates/visibility", response_model=list[TemplateVisibilityItem])
async def list_template_visibility(db: DbSession, _admin: AdminAccount):
    """템플릿별 공개 여부 목록 (admin 전용)."""
    service = AuthService(db)
    return await service.get_templates_visibility()


@router.put("/templates/visibility")
async def update_template_visibility(
    db: DbSession,
    _admin: AdminAccount,
    data: TemplateVisibilityUpdateRequest,
):
    """템플릿 공개 여부 일괄 업데이트 (admin 전용)."""
    service = AuthService(db)
    await service.update_templates_visibility(
        [{"id": UUID(t.id), "is_public_to_tester": t.is_public_to_tester} for t in data.templates]
    )
    return {"success": True}

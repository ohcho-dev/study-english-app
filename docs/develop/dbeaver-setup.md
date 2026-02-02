# DBeaver 로컬 데이터베이스 연결 가이드

이 문서는 로컬 개발 환경에서 실행 중인 PostgreSQL 데이터베이스에 **DBeaver**를 사용하여 연결하는 방법을 설명합니다.

## 1. 전제 조건
- Docker Desktop이 실행 중이어야 합니다.
- 서버가 실행 중이어야 합니다 (`scripts/start-server.sh` 또는 `docker-compose up`).
- DBeaver가 설치되어 있어야 합니다.

## 2. DBeaver 연결 설정

1. **DBeaver**를 실행합니다.
2. 좌측 상단 도구 모음에서 **"New Database Connection"** 아이콘(플러그 모양 또는 `+` 버튼)을 클릭합니다.
3. 데이터베이스 목록에서 **PostgreSQL**을 선택하고 **[Next]**를 클릭합니다.
4. **Connection Settings** 탭에서 아래 정보를 입력합니다:

| 항목 | 설정값 | 비고 |
|------|--------|------|
| **Host** | `localhost` | |
| **Port** | `5432` | `apps/server/docker-compose.yml` 설정 |
| **Database** | `studyenglish` | 기본값 `postgres` 대신 **`studyenglish`**를 입력하세요. |
| **Username** | `postgres` | |
| **Password** | `postgres` | |

5. **Show all databases** 체크박스는 선택 사항입니다 (체크하면 다른 시스템 DB도 보입니다).
6. **Authentication**은 `Database Native` (기본값)을 유지합니다.
7. 하단의 **[Test Connection ...]** 버튼을 클릭하여 연결을 확인합니다.
   - *Connected* 메시지가 나오면 성공입니다.
   - 드라이버 다운로드 팝업이 뜨면 **[Download]**를 클릭하여 드라이버를 설치해주세요.
8. **[Finish]**를 클릭하여 설정을 완료합니다.

## 3. 데이터 확인
1. 좌측 **Database Navigator**에서 새로 생성된 연결(`postgres` 또는 `studyenglish`)을 펼칩니다.
2. **Databases** > **studyenglish** > **Schemas** > **public** > **Tables** 순서로 이동합니다.
3. `users`, `themes` 등의 테이블을 확인할 수 있습니다.
4. 테이블을 더블 클릭하면 데이터 탭에서 저장된 데이터를 조회하고 수정할 수 있습니다.

## 4. 트러블슈팅

### 연결 실패 시 확인 사항
- **Docker 컨테이너 실행 여부**: 터미널에서 `docker ps` 명령어로 `db` 컨테이너가 실행 중인지 확인하세요.
- **포트 충돌**: 이미 로컬에 다른 PostgreSQL이 5432 포트를 사용 중일 수 있습니다. 이 경우 `docker-compose.yml`에서 호스트 포트를 변경하거나 로컬 서비스를 중지해야 합니다.

### 권한 오류
- 설정된 Username/Password가 `docker-compose.yml` 파일의 내용과 일치하는지 확인하십시오.

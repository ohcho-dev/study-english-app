# Study English - Production Deployment Plan (AWS)

이 문서는 실서버 배포를 위한 클라우드 인프라, 스토리지, CI/CD 파이프라인 계획을 상세히 기술합니다.

## 1. Cloud Server (Compute)

### AWS EC2 (Elastic Compute Cloud)
- **Instance Type**: `t3.small` (2 vCPU, 2GB RAM) 권장 -> 초기 트래픽 대응 및 비용 효율성
  - *Note: `t3.micro`는 메모리 부족 가능성 있음 (Next.js 빌드/실행 시)*
- **OS**: Ubuntu 22.04 LTS (안정성 및 Docker 호환성)
- **Elastic IP (EIP)**: 고정 IP 할당 (도메인 연결용)
- **Security Group**:
  - Inbound: 80 (HTTP), 443 (HTTPS), 22 (SSH - 관리자 IP만 허용)

### Alternative: AWS Lightsail
- **추천 사양**: **$20/월 플랜 (4GB RAM, 2 vCPU)**
  - **이유**: Next.js(Admin), FastAPI(Server), DB, Redis 동시 구동 시 2GB RAM($10)은 OOM(Out of Memory) 위험이 매우 높음.
  - 빌드 시점에도 Next.js가 1GB 이상 소모할 수 있어 안정성을 위해 4GB 필수.
- **구성**:
  - Docker Compose로 모든 서비스(App, DB, Redis) 단일 인스턴스 배포.
  - 비용 효율적이며 소규모 트래픽에 적합.

### Alternative: Google Cloud Platform (GCP)
- **Compute Engine (e2-medium)**:
  - Docker Compose 배포 시 EC2/Lightsail과 유사.
  - **비용**: ~$25-30/월 (4GB RAM 기준). **트래픽 비용 별도** (Lightsail은 수 TB 무료 포함이므로 GCP가 불리).
- **Cloud Run (Serverless)**:
  - **장점**: 트래픽에 따라 0원으로 축소 가능, 완전 관리형.
  - **단점**: DB(Cloud SQL)와 Redis(Memorystore)를 별도로 써야 하므로 **최소 고정 비용이 높음** (DB만 최소 $10~$50/월).
  - **결론**: 초기 스타트업/토이 프로젝트에는 **비추천** (비용 및 복잡도 증가).

---

## 2. Storage & Database

### File Storage: AWS S3
- **Bucket**: `study-english-prod-media` (Private Access 원칙)
- **Usage**:
  - 사용자 녹음 파일 (Run0/MyTurn)
  - TTS 생성 오디오 캐싱
- **Access Control**:
  - IAM User/Role을 통한 서버 접근 권한 부여 (`AmazonS3FullAccess` or restricted policy)
  - Presigned URL 사용 (보안 강화) 또는 CloudFront 연동 (CDN)

### Database: AWS RDS (Relational Database Service)
- **Engine**: PostgreSQL 15+
- **Instance Class**: `db.t3.micro` (Free Tier 가능)
- **Storage**: 20GB (Autoscaling 활성화)
- **Backup**: 자동 백업 (7일) 활성화
- **Security**: EC2 인스턴스에서만 접근 허용 (VPC 내 통신)

### Redis (Optional)
- **ElastiCache**는 비용이 높으므로, 초기에는 **Docker Container on EC2** 사용 권장.
- 트래픽 증가 시 ElastiCache for Redis로 마이그레이션.

---

## 3. CI/CD Pipeline (GitHub Actions)

자동화된 빌드 및 배포 파이프라인 구축.

### Workflow: `deploy.yml`

1.  **Trigger**: `main` 브랜치에 Push 또는 PR Merge 시.
2.  **Build Stage**:
    - Checkout Code
    - Setup Docker Buildx
    - Login to **AWS ECR (Elastic Container Registry)**
    - Build & Push Docker Images:
        - `study-english-server:latest`
        - `study-english-admin:latest`
3.  **Deploy Stage**:
    - Connect to EC2 via SSH (using Secrets)
    - Pull latest images from ECR
    - `docker-compose up -d --force-recreate` 실행
    - Prune unused images

### Environment Variables
- GitHub Secrets에 프로덕션 환경 변수 저장:
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - `EC2_HOST`, `EC2_SSH_KEY`
  - `DATABASE_URL`, `S3_BUCKET_NAME` 등

---

## 4. Architecture Diagram

```mermaid
graph TD
    User([User]) -->|HTTPS| ALB[Nginx (Reverse Proxy)]
    ALB -->|/api| Server[FastAPI Server (Docker)]
    ALB -->|/| Admin[Next.js Admin (Docker)]
    
    Server -->|Read/Write| DB[(AWS RDS PostgreSQL)]
    Server -->|Cache| Redis[(Redis Container)]
    Server -->|Save Audio| S3[(AWS S3 Bucket)]
    
    GitHub[GitHub Actions] -->|Push Image| ECR[AWS ECR]
    GitHub -->|SSH Deploy| EC2[EC2 Instance]
    EC2 -->|Pull Image| ECR
```

## 5. Implementation Steps

1.  **AWS Setup**: VPC, EC2, RDS, S3, ECR 생성.
2.  **Backend Refactoring**: S3 파일 업로드 로직 구현 (`boto3`).
3.  **Dockerization**: Admin/Server Dockerfile 최적화.
4.  **CI/CD Configuration**: `.github/workflows/deploy.yml` 작성.
5.  **Nginx & SSL**: EC2 내부 Nginx 설정 및 Certbot 인증서 발급.

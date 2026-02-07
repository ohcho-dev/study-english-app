#!/bin/bash

# Admin 서버를 HTTPS로 외부 공유 가능하게 실행하는 스크립트
# ngrok이 필요합니다: brew install ngrok

echo "🚀 Admin 서버를 시작합니다..."

# 백그라운드에서 admin 서버 시작
pnpm --filter admin dev &
ADMIN_PID=$!

# 서버가 시작될 때까지 대기
echo "⏳ 서버 시작 대기 중..."
sleep 5

# ngrok으로 터널링
echo "🔗 ngrok 터널 생성 중..."
ngrok http 3000

# 스크립트 종료 시 admin 서버도 종료
kill $ADMIN_PID 2>/dev/null

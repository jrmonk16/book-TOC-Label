#!/bin/bash
# 이 파일을 더블클릭하면 자동 설치됩니다

APP_NAME="PDF TOC LLM.app"
DMG_DIR="$(cd "$(dirname "$0")"; pwd)"
APP_PATH="$DMG_DIR/$APP_NAME"

# .app이 같은 폴더에 없으면 찾기
if [ ! -d "$APP_PATH" ]; then
  APP_PATH=$(find "$DMG_DIR" -name "$APP_NAME" -maxdepth 2 | head -1)
fi

if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
  osascript -e 'display alert "설치 실패" message "PDF TOC LLM.app 파일을 이 스크립트와 같은 폴더에 두고 다시 실행해주세요."'
  exit 1
fi

# Applications 폴더로 복사
echo "📦 Applications 폴더에 설치 중..."
cp -R "$APP_PATH" /Applications/

# 손상 경고 제거 (Gatekeeper 우회)
echo "🔓 보안 잠금 해제 중..."
xattr -cr "/Applications/$APP_NAME"

# 완료 알림
osascript -e 'display notification "PDF TOC LLM 설치 완료!" with title "설치 완료" subtitle "Launchpad 또는 Applications에서 실행하세요"'
echo "✅ 설치 완료!"
open "/Applications/$APP_NAME"

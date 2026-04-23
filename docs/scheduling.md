# 새벽 자동 실행 가이드

## 개요

프로젝트 생성과 파이프라인 진행은 웹 API가 백그라운드에서 `claude -p` 헤드리스 CLI와 Node 스크립트를 spawn하므로, **외부 스케줄러에서 "프로젝트 생성 API를 호출"하는 단 한 번의 트리거만 있으면** 새벽 자동 실행이 완성됩니다.

각 OS별 스케줄러 설정 예시를 수록합니다. 웹 서버(`cd web && npm run dev`)가 미리 떠 있어야 합니다. 영구 실행을 원하면 `pm2` 같은 프로세스 매니저로 올리세요.

전제:
- Claude Code CLI가 `claude /login` 1회 완료되어 Max Plan 세션 유지 중
- `.env`에 `GOOGLE_GENERATIVE_AI_API_KEY`, `YOUTUBE_API_KEY`, (업로드할 경우) `YOUTUBE_OAUTH_CLIENT_ID/SECRET` 설정
- YouTube 업로드는 별도 1회 OAuth 동의 필요 (대시보드의 "YouTube 계정 연결" 버튼)

---

## 트리거 스크립트

매일 새벽에 실행할 **단일 명령**입니다. `curl`로 프로젝트를 생성하면 리서치부터 숏폼 생성까지 체인이 자동으로 돕니다.

`scripts/nightly-trigger.sh` (macOS / Linux):
```bash
#!/usr/bin/env bash
set -euo pipefail

DATE=$(date +%Y-%m-%d)
SLUG="nightly-$DATE"
THEME="${NIGHTLY_THEME:-}"

curl -fsS -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg id "$SLUG" --arg theme "$THEME" '{id:$id, theme:$theme, language:"ko"}')"
```

`scripts\nightly-trigger.ps1` (Windows PowerShell):
```powershell
$Date = Get-Date -Format "yyyy-MM-dd"
$Slug = "nightly-$Date"
$Body = @{ id = $Slug; theme = $env:NIGHTLY_THEME; language = "ko" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/projects" `
  -ContentType "application/json" -Body $Body
```

---

## macOS — launchd

파일: `~/Library/LaunchAgents/com.youtube-auto.nightly.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>             <string>com.youtube-auto.nightly</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/ABSOLUTE/PATH/TO/YouTube-Auto-Production/scripts/nightly-trigger.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>    <integer>3</integer>
    <key>Minute</key>  <integer>0</integer>
  </dict>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NIGHTLY_THEME</key>  <string>자기기만</string>
  </dict>
  <key>StandardOutPath</key>   <string>/tmp/youtube-auto.out</string>
  <key>StandardErrorPath</key> <string>/tmp/youtube-auto.err</string>
</dict>
</plist>
```

등록:
```bash
launchctl load ~/Library/LaunchAgents/com.youtube-auto.nightly.plist
launchctl start com.youtube-auto.nightly  # 즉시 테스트
launchctl unload ~/Library/LaunchAgents/com.youtube-auto.nightly.plist  # 해제
```

주의: Mac이 잠자기 중이면 실행 안 됨. `pmset` 또는 Amphetamine/Caffeine으로 새벽에 깨어 있게 하거나, 데스크톱이면 `pmset repeat wakeorpoweron` 스케줄을 같이 잡으세요.

---

## Windows — Task Scheduler (`schtasks`)

### 대화형 UI
`작업 스케줄러` 열기 → `작업 만들기` →
- 트리거: 매일 03:00
- 동작: 프로그램 시작 → `pwsh` (또는 `powershell`), 인수 `-File "C:\GitHub\YouTube-Auto-Production\scripts\nightly-trigger.ps1"`
- 조건: "전원을 사용할 수 있는 경우에만 시작" 체크 해제, "컴퓨터를 절전 모드에서 깨우기" 체크

### 커맨드라인 등록 (관리자 PowerShell)
```powershell
schtasks /Create /TN "YouTubeAuto-Nightly" `
  /TR "pwsh -File C:\GitHub\YouTube-Auto-Production\scripts\nightly-trigger.ps1" `
  /SC DAILY /ST 03:00 /RL HIGHEST /F
```

삭제:
```powershell
schtasks /Delete /TN "YouTubeAuto-Nightly" /F
```

---

## Linux — cron

`crontab -e`에 추가:
```
0 3 * * * cd /path/to/YouTube-Auto-Production && NIGHTLY_THEME="자기기만" ./scripts/nightly-trigger.sh >> /var/log/youtube-auto.log 2>&1
```

---

## 테마 자동 선택

스크립트를 호출할 때 `NIGHTLY_THEME`을 비워두면 research 단계가 자동 탐색 모드(`--theme` 없이)로 돕니다. 철학/심리학 시드 키워드에서 주제 풀을 만든 뒤 researcher-planner가 큐레이션합니다.

주제 풀을 파일에서 로테이션하려면 `scripts/theme-rotate.sh`를 작성해 해당 일자의 테마를 뽑아 `NIGHTLY_THEME`에 넣은 뒤 trigger를 호출하세요.

---

## 아침 검토 흐름

1. 스케줄러가 새벽 03:00에 프로젝트 생성
2. 리서치(약 2–5분) → researcher-planner (약 3–8분) → **topic_selection에서 멈춤**
3. 아침에 대시보드 열면 주제 후보 표가 준비돼 있음 → 하나 선택
4. 선택한 순간 대본 생성 + 팩트체크가 자동 시작 (약 10–20분)
5. `script_approval` 체크포인트에서 승인 → 이미지 병렬 생성 (약 1–3분) → Veo 클립 (선택) → `asset_check`
6. 에셋 확인 → TTS → 렌더 → 숏폼까지 자동
7. 완료되면 complete 화면에서 영상 재생 + YouTube 업로드 폼

**완전 무인**은 아님 — 주제 선택·대본 승인·에셋 확인 3개 체크포인트는 사람이 유지해야 합니다. 그렇지 않으면 품질이 망가질 수 있습니다.

---

## 로그 위치

- 백그라운드 작업 실시간 tail: `projects/{id}/output/progress.json` (웹 UI에서 자동 표시)
- launchd stdout/stderr: `/tmp/youtube-auto.{out,err}`
- cron: crontab의 redirect (`>> /var/log/...`)
- schtasks: `이벤트 뷰어 → 애플리케이션 및 서비스 로그 → Microsoft → Windows → TaskScheduler`

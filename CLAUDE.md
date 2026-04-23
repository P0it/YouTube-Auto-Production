# YouTube 영상 자동 생성 프로젝트

## 개요
철학/심리학 채널의 롱폼 영상을 자동으로 생성하는 파이프라인.
공식: **일상 경험 훅 → 학문적 해석 → 연구 사례 → 심화 → 통합**.

입력(테마) → 리서치 → 대본 → 팩트체크 → 이미지 자동 생성 → Veo 클립 생성 → TTS → Remotion 렌더링 → 숏폼.

## 기술 스택
- **Remotion**: 영상 렌더링 + 동적 효과 (Ken Burns, 줌, 팬, 크로스 디졸브)
- **LLM**: **Claude Max Plan**을 `claude -p` 헤드리스 CLI로 호출. **Anthropic API(유료) 절대 사용 안 함.** 로컬 Ollama는 경량 fallback.
- **이미지**: Gemini Flash Image (`@google/genai`, `gemini-3.1-flash-image-preview`). 파트당 5–10장, 병렬 생성 (기본 동시 6개).
- **영상 클립**: Gemini Veo (`veo-3.1-fast-generate-preview`). 섹션 경계에 4초 클립 3–5개.
- **TTS**: Gemini TTS (`gemini-3.1-flash-tts-preview`, 보이스 `Achernar` 기본).
- **리서치 raw**: YouTube Data API + Google Trends.
- **웹 대시보드**: Next.js (`web/`) — 실시간 진행 로그 + 에셋 확인 + 체크포인트 승인.
- **에이전트**: Claude Code 서브에이전트 (`.claude/agents/` — 영어로 작성)

## 언어
- **주 언어**: 한국어 (시청자 대상). `meta.json.language = "ko"`.
- 영어 확장 슬롯 존재.

## 디렉토리 규칙
- `projects/{id}/` — 개별 영상 프로젝트
  - `meta.json` — 상태·언어·주제
  - `research.md` — researcher-planner 결과 (10–15 주제)
  - `raw-trends.json` — YouTube/Trends raw 데이터
  - `script.md` / `script-verified.md` — 7파트 한국어 대본
  - `assets/generated/` — Gemini 이미지 (`part_NN_SS.png`) + `metadata.json`
  - `assets/clips/` — Veo 영상 클립 (`part_NN_0.mp4`) + `metadata.json`
  - `assets/images/` · `assets/videos/` — 사용자 override 에셋
  - `output/audio/` — Gemini TTS 결과 (`part_NN.wav`) + `manifest.json`
  - `output/asset-map.json` — 렌더 에셋 타임라인
  - `output/remotion-props.json` — Remotion 렌더 props
  - `output/video/longform.mp4` — 최종 롱폼
  - `output/video/shorts/` — 숏폼 클립
  - `output/progress.json` — 백그라운드 작업 진행 로그 (UI 폴링 대상)
- `.claude/agents/` — 에이전트 정의 (영어)
- `config/` — `llm.json`, `image-generation.json`, `video-generation.json`, `tts.json`, `visual-style.json`, `voices.json`

## 대본 형식 (7파트 고정)
| 파트 | 제목 | 섹션 타입 | 이미지 스타일 |
|------|------|---------|-----------|
| 1 | 훅 (0:00~0:30) | hook | cinematic |
| 2 | 도입 (0:30~1:30) | framing | cinematic |
| 3 | 학문적 해석 (1:30~4:00) | analysis | illustration |
| 4 | 연구 사례 (4:00~7:00) | cases | illustration |
| 5 | 심화 (7:00~10:00) | deep | cinematic |
| 6 | 통합 (10:00~11:00) | synthesis | illustration |
| 7 | 아우트로 (11:00~12:00) | outro | cinematic |

**마크업 규칙:**
- 나레이션: 일반 텍스트
- `[영상 지시: 장면 설명]` — 파트당 **5–10개 필수** (이미지 생성 소스)
- `[출처: 저자 (연도), 논문·실험명]` — 파트 4 필수
- `**단어**` — 자막 하이라이트 (파트당 1–2개)
- `[효과음: 설명]` — 드물게

## LLM 라우팅 (`LLM_STRATEGY`)
- `hybrid` (기본) — research/script/fact-check는 `claude -p` 헤드리스, parse/image-prompt는 Ollama
- `claude-code-only` — 전부 `claude -p`
- `local-only` — 전부 Ollama (오프라인 개발)

**중요**: Claude 호출은 전부 `claude -p --dangerously-skip-permissions "..."` 로 **Claude Code CLI를 서브프로세스로 spawn**합니다. Anthropic API (유료) 절대 사용하지 않음. Max Plan 토큰으로 커버됨.

전제 조건: 호스트에 `claude` CLI 설치 + `claude /login` 1회 완료.

## 파이프라인 상태 (meta.status)
```
researching → topic_selection (⏸) → scripting → verifying
→ script_approval (⏸) → image_generation → video_clips → asset_check (⏸)
→ tts → editing → shorts → complete
```
⏸ = 사용자 체크포인트 (총 3곳). 나머지는 웹 API가 백그라운드 spawn으로 자동 진행.

## 명령어
- `npm run dev` — Remotion 스튜디오
- `npm run build` — TypeScript 타입 체크
- `npm run research -- --project <id> --theme "<테마>" --language ko`
- `npm run generate-images -- --project <id>` (병렬, 기본 동시 6)
- `npm run generate-images -- --project <id> --part 3 --regenerate`
- `npm run generate-video-clips -- --project <id>` (Veo, 느림)
- `npm run generate-tts -- --project <id>` (Gemini TTS)
- `npm run render-video -- --project <id>` (에셋 맵 자동 생성 + Remotion 렌더)
- 웹 대시보드: `cd web && npm run dev`

## 환경변수 (`.env`)
- `YOUTUBE_API_KEY` — 리서치
- `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini (이미지·영상·TTS 전부)
- `OLLAMA_ENDPOINT`, `OLLAMA_MODEL` — 로컬 fallback (선택)
- `LLM_STRATEGY` — 라우팅 전략
- `IMAGE_CONCURRENCY` — 이미지 병렬 수 (기본 6)
- `SKIP_VEO=1` — Veo 단계 건너뛰기 (빠른 파이프라인)

`ANTHROPIC_API_KEY`는 **절대 사용하지 않음**. 추가할 필요 없음.

## 에이전트 (`.claude/agents/`)
**모두 영어로 작성**. 산출물 예시는 해당 언어(한국어) 유지.
- `pd-producer` — 11단계 파이프라인 조율 (LLM 서브에이전트 + Bash CLI)
- `researcher-planner` — 철학/심리학 주제 10–15개 큐레이션 + 학술 검증
- `scriptwriter` — 7파트 한국어 대본, 파트당 5–10개 영상 지시
- `fact-checker` — 인용 실재성 + 구조 + 톤 검증
- `shorts-creator` — 숏폼 클립 3–5개 선정 및 Remotion 렌더

**제거됨**: `tts-narrator`, `video-editor` — 결정론적 작업이라 CLI로 대체.

## 진행 상황 관찰
백그라운드 스크립트는 `projects/{id}/output/progress.json`에 실시간 로그·단계·종료 코드·PID·heartbeat을 기록. 웹 UI가 `/api/projects/{id}/progress`로 5초마다 폴링해서 stage / 이미지·클립·오디오 카운트 / stdout tail / 로그 파일 경로를 표시.

전체 로그는 `projects/{id}/output/logs/{stage}.log`에 누적 저장 (서버 재시작해도 보존).

## 중단 복구 (crash recovery)
- 모든 백그라운드 작업은 **detached 프로세스**로 spawn됩니다. 웹 서버가 재시작/죽어도 자식 프로세스는 계속 돎.
- 서버 시작 시 `web/src/instrumentation.ts`가 `sweepPipelines()`를 호출 → 모든 프로젝트의 progress.json을 검사해 **PID가 죽었거나 heartbeat이 30분 이상 없으면 `crashed: true`**로 표시.
- 대시보드에 빨간 **"작업 중단 감지"** 배너 + "이어서 재시도" 버튼 표시.
- 재시도는 `/api/projects/[id]/resume`을 호출 → 현재 `meta.status`에 해당하는 stage runner (src/lib/pipeline-stages.ts)를 재실행. 이미 생성된 파일(이미지·TTS·클립)은 자동 skip되므로 중복 생성 없음.

## 팩트체크 모드
- `FACT_CHECK_MODE=full` (기본) — 인용 실재성 + 주장 정확도 + 재현성 논의 + 톤 (5–15분). 실제 업로드 대상.
- `FACT_CHECK_MODE=quick` — 인용 존재만 + 구조 (2–4분). 드래프트/반복 작업용.

## 완료 후 업로드 플로우
`complete` 상태가 되면 대시보드의 프로젝트 상세 페이지에서:
1. 최종 영상을 웹 플레이어로 재생 (`/api/projects/{id}/video` 스트리밍, HTTP range)
2. YouTube 업로드 폼에 제목·설명·태그·공개범위·카테고리·썸네일 입력
3. "YouTube에 업로드" 버튼 → `videos.insert` API로 백그라운드 업로드, 진행률 실시간 표시
4. 완료 후 `youtube.com/watch?v=...` 링크 자동 제공

### 사전 설정 (한 번만)
- Google Cloud Console → 프로젝트 생성 → YouTube Data API v3 활성화
- Credentials → OAuth 2.0 Client ID → "Web application"
  - Authorized redirect URI: `http://localhost:3000/api/youtube/oauth/callback`
- 발급된 Client ID/Secret을 `.env`의 `YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_CLIENT_SECRET`에 저장
- 대시보드에서 "YouTube 계정 연결" 클릭 → Google 동의 화면 완료
- Refresh token은 `data/youtube-token.json`에 저장되어 이후 자동 갱신

## 스케줄링
새벽 자동 실행 가이드: [`docs/scheduling.md`](./docs/scheduling.md)
- macOS `launchd`, Windows `schtasks`, Linux `cron` 설정 예시
- 트리거 스크립트: `scripts/cron/nightly-trigger.sh`, `scripts/cron/nightly-trigger.ps1`
- 완전 무인은 아님 — 주제 선택·대본 승인·에셋 확인 3개 체크포인트는 사람이 유지

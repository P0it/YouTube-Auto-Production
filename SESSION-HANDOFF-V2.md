# YouTube Auto Production — 세션 핸드오프 v2

## 현재 상태: Phase 2 웹 대시보드 구현 완료, YouTube-Auto-Production 레포로 이관 필요

---

## 이전 세션에서 완료된 작업

### 1. 프로젝트 전체 구조 (빌드 통과)

```
YouTube-Auto-Production/   ← 레포 루트
├── .claude/agents/         ← 7개 에이전트 정의
│   ├── pd-producer.md      (총괄 PD)
│   ├── researcher-planner.md (기획/리서치)
│   ├── scriptwriter.md     (대본 작가)
│   ├── fact-checker.md     (팩트체커)
│   ├── tts-narrator.md     (TTS)
│   ├── video-editor.md     (편집)
│   └── shorts-creator.md   (숏폼)
├── src/remotion/
│   ├── lib/
│   │   ├── types.ts        ← 공유 타입 (Script, AudioSegment 등)
│   │   ├── script-parser.ts ← 대본 파싱 + 자막 생성
│   │   ├── youtube-api.ts  ← YouTube Data API 래퍼
│   │   ├── google-trends.ts ← Google Trends 래퍼
│   │   ├── tts.ts          ← ElevenLabs TTS 래퍼
│   │   ├── llm.ts          ← ★ Ollama API 클라이언트 (신규)
│   │   └── google-trends-api.d.ts
│   ├── components/
│   │   ├── Subtitle.tsx, ImageScene.tsx, AudioTrack.tsx
│   ├── compositions/
│   │   ├── LongformVideo.tsx (1920x1080)
│   │   └── ShortformVideo.tsx (1080x1920)
│   ├── Root.tsx, index.ts
├── src/scripts/
│   ├── generate-script.ts  ← ★ CLI: 주제 → Ollama → 대본 (신규)
│   └── fact-check.ts       ← ★ CLI: 대본 → Ollama → 검증 (신규)
├── web/                    ← ★ Next.js 웹 대시보드 (신규)
│   ├── src/app/
│   │   ├── page.tsx        ← 메인: 프로젝트 목록 + 생성
│   │   ├── project/[id]/page.tsx ← 프로젝트 상세: 대본생성/편집/팩트체크
│   │   ├── api/generate/route.ts ← Ollama SSE 스트리밍 API
│   │   ├── api/projects/route.ts ← 프로젝트 CRUD
│   │   └── api/projects/[id]/route.ts ← 프로젝트 파일 읽기/쓰기
│   ├── package.json, tsconfig.json, next.config.ts 등
├── config/
│   ├── voices.json         ← ElevenLabs 음성 (voiceId 미입력)
│   └── llm.json            ← ★ Ollama 설정 (qwen3:30b)
├── projects/
│   ├── trend-test-v3/research.md  ← 원본 리서치 (10개 주제)
│   ├── trend-test-v4/research.md  ← ★ "세상에이런일이" 스타일 (10개)
│   ├── trend-test-v5/research.md  ← ★ 시니어 타겟 (10개)
│   └── stamatis-blue-zone/
│       ├── script.md              ← ★ 대본 (시한부 남자 46년 생존)
│       └── script-verified.md     ← ★ 팩트체크 완료 대본
├── .env.example
├── .gitignore
├── CLAUDE.md
├── package.json
├── tsconfig.json
└── remotion.config.ts
```

### 2. 이전 세션 대비 신규 작업 (★ 표시)

| 작업 | 상세 |
|------|------|
| **Ollama LLM 통합** | `llm.ts` (Ollama API 클라이언트), CLI 스크립트 2개 |
| **Next.js 웹 대시보드** | 프로젝트 관리, 대본 생성(SSE 스트리밍), 편집, 팩트체크 |
| **트렌드 리서치 v4** | "세상에 이런일이" 스타일 10개 주제 (춤 전염병, 화장실 참사, 당밀 대홍수 등) |
| **트렌드 리서치 v5** | 시니어(60대+) 타겟 10개 주제 (피니어스 게이지, 블루존, 파라바이오시스 등) |
| **샘플 대본 + 팩트체크** | "시한부 선고 후 37년 생존" 주제, 9분30초 분량, 팩트체크 6건 수정 반영 |
| **LLM 모델 선정** | llama3 → qwen3:30b (한국어 품질 우수, Mac Mini M4 32GB 최적) |

### 3. 코드 현재 위치

- **Dripple 레포**: `P0it/Dripple` 브랜치 `claude/youtube-auto-production-iTa43`의 `YouTube/` 폴더에 모든 코드 존재
- **YouTube-Auto-Production 레포**: 사용자가 수동으로 이관 완료 예정
- 이관 방법: Dripple 레포의 `YouTube/` 폴더 내용을 YouTube-Auto-Production 레포 루트로 복사

### 4. API 키 / 설정 상태

- `.env.example` 존재 (YOUTUBE_API_KEY, ELEVENLABS_API_KEY)
- `config/voices.json`: voiceId 미입력 (ElevenLabs에서 한국어 음성 선택 필요)
- `config/llm.json`: `qwen3:30b` 설정 완료
- Ollama는 사용자 맥미니에 설치 필요 (`ollama pull qwen3:30b`)

---

## 다음 해야 할 일

### 즉시 가능 (웹 대시보드 활용)

1. **Ollama 설치 + 모델 다운로드** — `ollama pull qwen3:30b`
2. **웹 대시보드 실행** — `cd web && npm install && npm run dev` → `http://localhost:3000`
3. **대본 생성 테스트** — 웹에서 주제 입력 → Qwen3 실시간 스트리밍 확인
4. **팩트체크 테스트** — 생성된 대본에 버튼 클릭으로 검증

### 파이프라인 완성

5. **ElevenLabs 음성 설정** — `listVoices()`로 한국어 음성 확인 후 `config/voices.json`에 voiceId 입력
6. **TTS 테스트** — 검증된 대본 → 음성 파일 생성
7. **에셋 준비** — `projects/{id}/assets/`에 이미지/영상 넣기
8. **Remotion 렌더링 테스트** — 음성 + 에셋 + 자막 → 영상
9. **숏폼 추출 테스트** — 롱폼에서 하이라이트 클립 추출

### 웹 대시보드 고도화

10. TTS 생성 UI 추가 (웹에서 음성 생성 버튼)
11. Remotion 미리보기 연동
12. 프로젝트 상태 관리 (research → script → verified → tts → rendering → complete)

---

## 워크플로우 (웹 대시보드 사용법)

```
http://localhost:3000 접속
  │
  ├─ [+ 새 프로젝트] 클릭 → 프로젝트 ID 입력
  │
  ├─ [대본 생성] 탭
  │   ├─ 주제 입력 (예: "시한부 9개월 선고받고 37년을 더 산 남자")
  │   └─ [대본 생성 (Qwen3)] 클릭 → 실시간 스트리밍 출력 → 자동 저장
  │
  ├─ [대본] 탭 → 직접 편집 가능, 포커스 벗어나면 자동 저장
  │
  ├─ [팩트체크 실행] 버튼 → Qwen3로 검증 → script-verified.md 저장
  │
  └─ [검증 대본] 탭 → 최종 대본 확인
```

---

## 리서치 히스토리

- v1~v2: 뻔한 트렌드 (이전 세션)
- v3: 신박한 주제 10개 (치킨집 > 맥도날드, 배꼽 세균 등)
- v4: "세상에 이런일이" 스타일 10개 (춤 전염병, 에뮤 전쟁, 타라르 등)
- v5: **시니어(60대+) 타겟** 10개 (블루존, 피니어스 게이지, 파라바이오시스 등) ← 최종 방향

### 시니어 타겟 인사이트

- 60대+ 유튜브 이용률 86.3%, 시청시간 전 연령 1위
- 선호 콘텐츠: 건강/웰빙 > 뉴스/시사 > 역사/향수 > 재테크
- 최적 조합: **건강/의학 + 기적적 생존 실화** (v5 방향)

---

## 기술 스택 요약

| 구성 요소 | 기술 |
|-----------|------|
| 대본 생성/팩트체크 | Ollama + Qwen3:30b (로컬 LLM) |
| 웹 대시보드 | Next.js 15 + Tailwind CSS |
| TTS | ElevenLabs API |
| 영상 렌더링 | Remotion |
| 리서치 | YouTube Data API + Google Trends |
| 런타임 | Mac Mini M4 32GB |

---

## 주요 파일 위치

- 전체 설계: `docs/superpowers/specs/2026-04-03-youtube-auto-production-design.md`
- 프로젝트 지침: `CLAUDE.md`
- LLM 설정: `config/llm.json`
- 웹 대시보드: `web/`
- 에이전트 정의: `.claude/agents/`
- 샘플 대본: `projects/stamatis-blue-zone/script-verified.md`
- 시니어 리서치: `projects/trend-test-v5/research.md`

# YouTube 영상 자동 생성 프로젝트 — 세션 핸드오프

## 현재 상태: Phase 1 구현 완료, 리서치 테스트 완료

---

## 완료된 작업

### 1. 프로젝트 구조 (전체 빌드 통과)
```
YouTube/
├── .claude/agents/          ← 7개 에이전트 정의 완료
│   ├── pd-producer.md       (총괄 PD - Opus)
│   ├── researcher-planner.md (기획/리서치 - Sonnet, v2 개선됨)
│   ├── scriptwriter.md      (대본 작가 - Opus)
│   ├── fact-checker.md      (팩트체커 - Sonnet)
│   ├── tts-narrator.md      (TTS - Haiku)
│   ├── video-editor.md      (편집 - Sonnet)
│   └── shorts-creator.md    (숏폼 - Sonnet)
├── src/remotion/
│   ├── lib/types.ts          ← 공유 타입 (Script, AudioSegment 등)
│   ├── lib/script-parser.ts  ← 대본 파싱 + 자막 생성
│   ├── lib/youtube-api.ts    ← YouTube Data API 래퍼
│   ├── lib/google-trends.ts  ← Google Trends 래퍼
│   ├── lib/tts.ts            ← ElevenLabs TTS 래퍼
│   ├── components/Subtitle.tsx, ImageScene.tsx, AudioTrack.tsx
│   ├── compositions/LongformVideo.tsx (1920x1080)
│   ├── compositions/ShortformVideo.tsx (1080x1920)
│   ├── Root.tsx, index.ts
├── config/voices.json        ← ElevenLabs 음성 설정 (voiceId 미입력)
├── .env                      ← API 키 설정 완료
├── docs/superpowers/
│   ├── specs/2026-04-03-youtube-auto-production-design.md
│   └── plans/2026-04-03-youtube-auto-production.md
└── projects/
    ├── trend-test/research.md      ← v1 리서치 (뻔한 트렌드)
    ├── trend-test-v2/research.md   ← v2 리서치 (각도 개선)
    └── trend-test-v3/research.md   ← v3 리서치 (신박한 주제) ★ 최종
```

### 2. API 키 설정 (.env)
- YOUTUBE_API_KEY: 설정 완료
- ELEVENLABS_API_KEY: 설정 완료
- config/voices.json의 voiceId는 아직 미설정 (ElevenLabs에서 한국어 음성 선택 필요)

### 3. Git 커밋 히스토리
```
d0e0959 feat: improve researcher agent + add trend research results
758432e feat: add 7 agent definition files for video production pipeline
d00379c feat: add Longform and Shortform video compositions
bd965c1 feat: add API wrappers for YouTube, Google Trends, ElevenLabs
cc3f8a7 feat: add Remotion components (Subtitle, ImageScene, AudioTrack)
9281372 feat: add shared types and script parser
cf5bd34 feat: initialize Remotion project with TypeScript
```
- 리모트 저장소 미설정 (push 안 됨)

---

## 다음 해야 할 일

### 즉시 가능
1. **주제 선택** — trend-test-v3/research.md에서 마음에 드는 주제 선택
2. **대본 작성 테스트** — 선택한 주제로 scriptwriter 에이전트 실행
3. **팩트체커 테스트** — 생성된 대본에 fact-checker 에이전트 실행
4. **ElevenLabs 음성 설정** — listVoices()로 한국어 음성 확인 후 config/voices.json에 voiceId 입력

### 전체 파이프라인 테스트
5. **TTS 테스트** — 대본 → 음성 파일 생성
6. **에셋 준비** — projects/{id}/assets/에 이미지/영상 넣기
7. **Remotion 렌더링 테스트** — 음성 + 에셋 + 자막 → 영상
8. **숏폼 추출 테스트** — 롱폼에서 하이라이트 클립 추출

### 고도화 (Phase 2)
9. GitHub 리모트 설정 + push
10. 웹 대시보드 (Next.js)
11. Claude API 연동 자동화

---

## 워크플로우 (사용법)

PD 에이전트가 전체를 관리합니다. 다음과 같이 실행:

```
"국뽕 테마로 영상 만들어줘"
```

PD가 순서대로:
1. 기획 에이전트 → 주제 추천 → ⏸️ 사용자 선택
2. 작가 에이전트 → 8~12분 대본 작성
3. 검증 에이전트 → 자동 팩트체크
4. ⏸️ 사용자 대본 승인
5. ⏸️ 사용자 에셋 폴더에 이미지 넣기
6. TTS 에이전트 → ElevenLabs 음성 생성
7. 편집 에이전트 → Remotion 렌더링
8. 숏폼 에이전트 → 하이라이트 클립 추출

사용자 개입은 3곳만: 주제 선택, 대본 승인, 에셋 준비

---

## 리서치 에이전트 개선 히스토리

- v1: 뻔한 트렌드 나열 (트럼프 관세, GLP-1 등) → 사용자 피드백: "뻔하다"
- v2: 같은 주제에 자극적 제목만 바꿈 → 사용자 피드백: "주제 자체가 신박해야"
- v3: 주제 자체가 신박한 것 발굴 (배꼽 세균 2368종, 런던 맥주 쓰나미, 문어 화풀이 등) → 사용자 만족
- 핵심 교훈: "뻔하면 죽는다" 원칙 + 존재 자체를 모르는 사실 발굴이 핵심

---

## 주요 설계 문서 위치
- 전체 설계: `docs/superpowers/specs/2026-04-03-youtube-auto-production-design.md`
- 구현 계획: `docs/superpowers/plans/2026-04-03-youtube-auto-production.md`
- 프로젝트 지침: `CLAUDE.md`

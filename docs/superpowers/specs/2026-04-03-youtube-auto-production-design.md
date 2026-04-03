# YouTube 영상 자동 생성 프로젝트 — 설계 문서

**날짜**: 2026-04-03
**Phase**: Phase 1 (Claude Code 에이전트 기반)
**Phase 2 (미래)**: 웹 대시보드 + Claude API 자동화

---

## 1. 프로젝트 개요

테마/장르를 입력하면 리서치 → 대본 작성 → 검증 → TTS → 영상 편집 → 숏폼 추출까지 자동화되는 유튜브 영상 제작 파이프라인.

**핵심 원칙:**
- 장르 불문 범용 파이프라인 (국뽕, 건강정보, 호기심 스토리 등)
- 사용자 개입 최소화 (주제 선택, 대본 승인, 에셋 확인 3곳만)
- 롱폼(8분+) 기본 → 숏폼 자동 추출
- 미드롤 광고 조건(8분 이상) 충족

---

## 2. 기술 스택

| 구성 요소 | 기술 | 용도 |
|-----------|------|------|
| 에이전트 구동 | Claude Code (서브에이전트) | PD/기획/작가/검증/TTS/편집 에이전트 |
| LLM | Claude Opus/Sonnet/Haiku | 역할별 모델 분리 |
| TTS | ElevenLabs API | 한국어 음성 합성 |
| 영상 렌더링 | Remotion | 프로그래밍 방식 영상 생성 |
| 리서치 | YouTube Data API, Google Trends, 웹스크래핑 | 무료 API 우선 |
| 개발 도구 | gstack 스킬 통합 | Think→Plan→Build→Review 워크플로우 |

---

## 3. 에이전트 아키텍처

```
[사용자] ──→ PD 에이전트 (총괄 오케스트레이터)
                │
                ├─→ 기획 에이전트 (리서처)
                │     YouTube API, Google Trends, 웹스크래핑
                │     → 주제 5~10개 추천 리스트 출력
                │     → ⏸️ 사용자가 주제 선택
                │
                ├─→ 작가 에이전트 (대본 전문가)
                │     선택된 주제 → 8~12분 분량 대본 작성
                │     구조: 훅 → 도입 → 본론(3~4파트) → 결론 → CTA
                │     → ⏸️ 사용자가 대본 승인/수정 요청
                │
                ├─→ 검증 에이전트 (에디터/팩트체커)
                │     대본의 사실 검증, 흐름 체크, 개선 제안
                │     → 자동 실행 (사용자 개입 불필요)
                │
                ├─→ TTS 에이전트
                │     승인된 대본 → ElevenLabs API → 음성 파일 생성
                │     → 자동 실행
                │
                ├─→ 편집 에이전트 (Remotion)
                │     음성 + 에셋(사용자 제공) + 자막 → 롱폼 영상 렌더
                │     → ⏸️ 사용자 에셋 폴더 확인 후 실행
                │
                └─→ 숏폼 에이전트
                      롱폼에서 핵심 클립 3~5개 자동 추출
                      → 자동 실행
```

### 3.1 에이전트 상세 정의

#### PD 에이전트 (pd-producer)
- **정체성**: 10년차 유튜브 PD, 전체 파이프라인 총괄
- **모델**: Opus (의사결정 품질 중요)
- **도구**: Agent, Read, Write, Glob, Grep, Bash, AskUserQuestion, TodoWrite
- **역할**: 하위 에이전트 순차 호출, 단계별 품질 관리, 사용자 체크포인트 관리
- **워크플로우**:
  1. 테마/장르 수신
  2. 기획 에이전트 호출 → 주제 리스트 수신
  3. 사용자에게 주제 선택 요청
  4. 작가 에이전트 호출 → 대본 수신
  5. 검증 에이전트 호출 → 수정 대본 수신 (자동)
  6. 사용자에게 대본 승인 요청
  7. 에셋 폴더 확인 요청
  8. TTS → 편집 → 숏폼 순차 실행

#### 기획 에이전트 (researcher-planner)
- **정체성**: 유튜브 채널 전문 기획자 (100만+ 구독자 채널 경력)
- **모델**: Sonnet (리서치는 속도 중요)
- **도구**: Bash, WebSearch, WebFetch, Read, Write, Grep
- **전문성**: YouTube Data API, Google Trends, 경쟁 분석
- **출력**: 주제 5~10개 표 (순위, 주제, 예상 검색량, 경쟁도, 추천 이유)

#### 작가 에이전트 (scriptwriter)
- **정체성**: 유튜브 전문 방송작가 (조회수 100만+ 대본 50편 경력)
- **모델**: Opus (대본 품질 최우선)
- **도구**: Read, Write, WebSearch, WebFetch, Grep
- **전문성**: 시청 유지율 극대화 훅 설계, 미드롤 구조, 장르별 톤 전환
- **대본 구조**:
  1. 훅 (0:00~0:30) — 충격적 사실/질문
  2. 도입 (0:30~1:30) — 주제 소개
  3. 본론 파트1 (1:30~3:30) — 핵심 내용
  4. 본론 파트2 (3:30~5:30) — 심화/반전
  5. 본론 파트3 (5:30~7:30) — 클라이맥스
  6. 결론 (7:30~8:30) — 정리 및 인사이트
  7. CTA (8:30~9:00) — 구독/좋아요/다음 영상 예고
- **출력**: 나레이션 텍스트 + [영상 지시] 분리, 자막 하이라이트 포인트 표기

#### 검증 에이전트 (fact-checker)
- **정체성**: 방송 팩트체커 겸 편집장
- **모델**: Sonnet
- **도구**: WebSearch, WebFetch, Read, Write, Grep
- **체크리스트**: 사실 검증, 논리 흐름, 중복 제거, 톤 일관성, 시간 배분(8분+)
- **출력**: 수정 사항 목록 (🔴필수/🟡권장/🟢선택) + 수정 반영 최종 대본

#### TTS 에이전트 (tts-narrator)
- **정체성**: TTS 엔지니어
- **모델**: Haiku (단순 API 호출)
- **도구**: Bash, Read, Write
- **작업**: 대본 파트별 분리 → ElevenLabs API 호출 → 음성 파일 저장
- **출력**: output/audio/*.mp3 + 총 음성 길이 리포트

#### 편집 에이전트 (video-editor)
- **정체성**: Remotion 전문 영상 편집자
- **모델**: Sonnet
- **도구**: Bash, Read, Write, Glob, Grep
- **작업**: 음성 + 에셋 매핑 + 자막 동기화 + Remotion 렌더링
- **출력**: output/video/longform.mp4

#### 숏폼 에이전트 (shorts-creator)
- **정체성**: 숏폼 콘텐츠 전문가
- **모델**: Sonnet
- **도구**: Bash, Read, Write, Glob
- **작업**: 롱폼 대본에서 훅/클라이맥스 구간 식별 → 60초 이내 클립 3~5개 추출
- **출력**: output/video/shorts/*.mp4

---

## 4. 디렉토리 구조

```
YouTube/
├── .claude/
│   └── agents/                    # 에이전트 정의 파일
│       ├── pd-producer.md
│       ├── researcher-planner.md
│       ├── scriptwriter.md
│       ├── fact-checker.md
│       ├── tts-narrator.md
│       ├── video-editor.md
│       └── shorts-creator.md
├── src/
│   └── remotion/                  # Remotion 프로젝트
│       ├── compositions/          # 영상 템플릿 컴포넌트
│       │   ├── LongformVideo.tsx
│       │   ├── ShortformVideo.tsx
│       │   └── components/
│       │       ├── Subtitle.tsx
│       │       ├── ImageScene.tsx
│       │       └── VideoScene.tsx
│       ├── utils/
│       │   ├── tts.ts             # ElevenLabs API 래퍼
│       │   ├── youtube-api.ts     # YouTube Data API 래퍼
│       │   └── google-trends.ts   # Google Trends 래퍼
│       ├── index.ts
│       └── Root.tsx
├── projects/                      # 프로젝트별 작업 디렉토리
│   └── {project-id}/
│       ├── research.md            # 리서치 결과
│       ├── script.md              # 대본
│       ├── script-verified.md     # 검증된 대본
│       ├── assets/                # 사용자가 넣는 이미지/영상
│       │   ├── images/
│       │   └── videos/
│       └── output/
│           ├── audio/             # TTS 음성 파일
│           ├── video/             # 렌더링된 영상
│           │   ├── longform.mp4
│           │   └── shorts/
│           └── metadata.json      # 제목, 설명, 태그, 썸네일 정보
├── templates/                     # 대본 템플릿
│   ├── hook-templates.md
│   └── script-structure.md
├── config/
│   ├── elevenlabs.json            # ElevenLabs 설정 (voice_id 등)
│   └── youtube-api.json           # YouTube API 키
├── docs/
│   └── superpowers/specs/
│       └── 2026-04-03-youtube-auto-production-design.md
├── package.json
├── tsconfig.json
└── CLAUDE.md                      # 프로젝트 지침
```

---

## 5. 워크플로우 상세

### 5.1 전체 파이프라인 흐름

```
사용자: "국뽕 주제로 영상 만들어줘"
    │
    ▼
[PD] 테마 파싱 → 기획 에이전트 호출
    │
    ▼
[기획] YouTube API + Trends + 웹 검색
    → 주제 10개 리스트 생성
    → PD에게 반환
    │
    ▼
[PD] 사용자에게 주제 리스트 제시
    → ⏸️ 사용자 선택 대기
    │
    ▼
[PD] 선택된 주제 + 리서치 데이터 → 작가 에이전트 호출
    │
    ▼
[작가] 8~12분 대본 작성
    → 나레이션 + 영상지시 + 자막포인트
    → PD에게 반환
    │
    ▼
[PD] 검증 에이전트 자동 호출
    │
    ▼
[검증] 팩트체크 + 흐름 수정
    → 수정된 대본 PD에게 반환
    │
    ▼
[PD] 사용자에게 최종 대본 제시
    → ⏸️ 승인/수정 요청 대기
    │
    ▼
[PD] "assets/{project-id}/ 폴더에 이미지/영상을 넣어주세요"
    → ⏸️ 에셋 준비 대기
    │
    ▼
[PD] TTS 에이전트 호출
    │
    ▼
[TTS] ElevenLabs API → 파트별 음성 생성
    → output/audio/ 저장
    │
    ▼
[PD] 편집 에이전트 호출
    │
    ▼
[편집] Remotion으로 음성+에셋+자막 조합
    → output/video/longform.mp4 렌더링
    │
    ▼
[PD] 숏폼 에이전트 호출
    │
    ▼
[숏폼] 롱폼에서 핵심 구간 3~5개 추출
    → output/video/shorts/ 렌더링
    │
    ▼
[PD] 완료 보고: 롱폼 1개 + 숏폼 N개 + 메타데이터
```

### 5.2 데이터 흐름

```
테마 (string)
  → 리서치 결과 (research.md)
    → 선택된 주제 (string)
      → 대본 (script.md)
        → 검증된 대본 (script-verified.md)
          → 음성 파일 (audio/*.mp3)
            → 영상 (video/longform.mp4)
              → 숏폼 (video/shorts/*.mp4)
```

각 단계의 중간 산출물은 `projects/{project-id}/` 에 파일로 저장되어 추적/재사용 가능.

---

## 6. 사용자 개입 포인트

| 단계 | 개입 유형 | 설명 |
|------|-----------|------|
| 주제 선택 | 필수 | 기획 에이전트가 제시한 리스트에서 선택 |
| 대본 승인 | 필수 | 검증 완료된 대본 확인, 수정 요청 가능 |
| 에셋 준비 | 필수 | assets/ 폴더에 이미지/영상 직접 배치 |

나머지 모든 단계는 자동 실행.

---

## 7. 외부 서비스 의존성

| 서비스 | 용도 | 과금 |
|--------|------|------|
| ElevenLabs API | TTS 음성 합성 | 월 $5~ (Starter) |
| YouTube Data API | 인기 영상/키워드 분석 | 무료 (일 10K 쿼터) |
| Google Trends | 검색량 추이 | 무료 (비공식 API) |

---

## 8. Phase 2 확장 계획 (미래)

- 웹 대시보드 (Next.js) — 상태 모니터링, 에셋 업로드, 대본 편집
- Claude API 통합 — 자동 스케줄링, 무인 파이프라인
- YouTube 자동 업로드 — YouTube Data API v3 upload
- 썸네일 자동 생성 — AI 이미지 생성
- A/B 테스트 — 제목/썸네일 성과 비교

# YouTube 영상 자동 생성 프로젝트

## 개요
테마 입력 → 리서치 → 대본 → TTS → Remotion 영상 렌더링 자동화 파이프라인

## 기술 스택
- Remotion: 영상 렌더링
- ElevenLabs: TTS
- YouTube Data API / Google Trends: 리서치
- Claude Code 서브에이전트: 워크플로우 자동화

## 디렉토리 규칙
- `projects/{id}/` — 개별 영상 프로젝트 작업 폴더
- `projects/{id}/assets/` — 사용자가 직접 넣는 이미지/영상 에셋
- `projects/{id}/output/` — 생성된 음성, 영상 파일
- `.claude/agents/` — 에이전트 정의 파일

## 대본 형식
나레이션 텍스트와 영상 지시를 분리:
- 나레이션: 일반 텍스트
- 영상 지시: [대괄호] 안에 표기
- 자막 하이라이트: **볼드** 표기

## 명령어
- `npm run dev` — Remotion 스튜디오 실행
- `npm run render` — 영상 렌더링
- `npm run build` — TypeScript 타입 체크

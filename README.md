# ClassReserv — 학교 특별실 예약 시스템

컴퓨터실 · AI실을 주 단위로 예약하고, 복도 TV 등에 띄울 수 있는 현황판을 제공하는 웹앱입니다.
요구사항 전체는 [CLAUDE.md](CLAUDE.md) 를 참고하세요.

## 화면

| 주소 | 설명 |
|---|---|
| `/` | 주간 예약 시간표 (특별실 탭, 주 이동, 칸 클릭 → 예약) |
| `/board` | 현황판 (읽기 전용, 이름 마스킹) |
| `/admin` | 관리자 페이지 (비밀번호) |

## 개인정보 처리 요약

- 교사 명단을 저장하지 않습니다. 예약자가 이름을 직접 입력합니다.
- 화면에 보이는 이름은 항상 마스킹됩니다 — 김철수 → **김O수** (마스킹은 서버/DB에서 수행)
- "필요 및 준비사항"은 현황판에 표시하지 않고 관리자만 볼 수 있습니다.
- 예약 수정·취소는 예약할 때 정한 4자리 PIN으로만 가능합니다 (bcrypt 해시 저장).
- 검색엔진 색인은 `robots.txt` 와 `noindex` 로 차단합니다.

## 로컬 실행

```bash
npm install
```

```bash
npm run dev
```

`http://localhost:3000` 에서 열립니다.
Supabase 환경변수가 없으면 **로컬 개발 모드**로 동작하며 데이터는 `.data/dev.json` 파일에 저장됩니다(git 제외).

## Supabase 연결

1. [supabase.com](https://supabase.com) 에서 프로젝트 생성
2. SQL Editor 에 [supabase/schema.sql](supabase/schema.sql) 전체를 붙여넣고 실행
3. Project Settings → API 에서 값 복사 후 `.env.local` 작성

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> `SUPABASE_SERVICE_ROLE_KEY` 는 RLS를 우회하는 키입니다. 저장소에 커밋하지 마세요.

## Vercel 배포

1. GitHub 저장소를 Vercel 에 Import
2. Environment Variables 에 위 두 값 등록
3. Deploy

## 명령어

```bash
npm run typecheck
```

```bash
npm run build
```

## 구조

```
app/
  page.tsx                    주간 예약 시간표 화면
  board/                      현황판
  admin/                      관리자 페이지
  api/schedule/               주간 조회 (공개, 마스킹된 데이터)
  api/reservations/           예약 생성·수정·취소 (PIN 확인)
components/                   화면 컴포넌트
lib/
  config.ts                   교시·과목·기기·학년반 등 운영 설정
  mask.ts                     이름 마스킹 규칙
  service.ts                  예약 규칙 검증, PIN 확인
  repo/                       저장소 어댑터 (supabase | local json)
supabase/schema.sql           테이블·마스킹 뷰·RLS·기본 설정
```

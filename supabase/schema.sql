-- =====================================================================
-- 특별실 예약 시스템 (ClassReserv) - Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.
--
-- 개인정보 원칙
--   * 교사 명단 테이블은 만들지 않는다 (예약자가 이름을 직접 입력)
--   * 익명(anon) 키로는 마스킹 뷰 reservations_public 만 읽을 수 있다
--   * 원본 이름·준비사항·PIN 해시는 서비스 키(서버)로만 접근한다
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 예약
-- ---------------------------------------------------------------------
create table if not exists public.reservations (
  id            uuid primary key default gen_random_uuid(),
  room_id       text        not null,
  date          date        not null,
  period_no     smallint    not null check (period_no between 1 and 7),
  subject       text        not null,
  teacher_name  text        not null,
  grade         text        not null,
  class_no      text        not null,
  device        text        not null,
  needs_ai_coordinator boolean not null default false,
  notes         text,
  pin_hash      text        not null,
  failed_count  smallint    not null default 0,
  locked_until  timestamptz,
  status        text        not null default 'active' check (status in ('active', 'cancelled')),
  is_anonymized boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 이미 배포된 DB에도 반영되도록 컬럼을 별도로 보장한다.
alter table public.reservations
  add column if not exists needs_ai_coordinator boolean not null default false;

-- 같은 특별실·날짜·교시에는 살아있는 예약이 하나만 존재할 수 있다.
create unique index if not exists reservations_slot_unique
  on public.reservations (room_id, date, period_no)
  where status = 'active';

create index if not exists reservations_room_date_idx
  on public.reservations (room_id, date);

-- ---------------------------------------------------------------------
-- 고정 점유 (정규 수업 등). 실제 예약 행을 만들지 않고 조회 시 합성한다.
-- ---------------------------------------------------------------------
create table if not exists public.fixed_blocks (
  id            uuid primary key default gen_random_uuid(),
  room_id       text     not null,
  weekday       smallint not null check (weekday between 1 and 5), -- 1=월 ~ 5=금
  period_no     smallint not null check (period_no between 1 and 7),
  label         text     not null,
  teacher_label text,
  start_date    date     not null,
  end_date      date     not null,
  is_active     boolean  not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists fixed_blocks_room_idx on public.fixed_blocks (room_id, weekday);

-- 특정 날짜만 고정 점유를 해제 (공휴일·시험 기간 등)
create table if not exists public.fixed_exceptions (
  id              uuid primary key default gen_random_uuid(),
  fixed_block_id  uuid not null references public.fixed_blocks (id) on delete cascade,
  date            date not null,
  unique (fixed_block_id, date)
);

-- ---------------------------------------------------------------------
-- 휴업일 / 설정 / 관리자 / 감사 로그
-- ---------------------------------------------------------------------
create table if not exists public.holidays (
  id   uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null
);

create table if not exists public.settings (
  key   text primary key,
  value jsonb not null
);

create table if not exists public.admin_config (
  id            smallint primary key default 1 check (id = 1),
  password_hash text not null,
  updated_at    timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  target_type text not null,
  target_id   text,
  actor       text not null check (actor in ('teacher', 'admin')),
  summary     text,                       -- 원본 이름은 기록하지 않는다
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 이름 마스킹: 김수 -> 김O, 김철수 -> 김O수, 남궁철수 -> 남OO수
-- ---------------------------------------------------------------------
create or replace function public.mask_name(name text)
returns text
language sql
immutable
as $$
  select case
    when name is null then null
    when char_length(btrim(name)) <= 1 then btrim(name)
    when char_length(btrim(name)) = 2 then left(btrim(name), 1) || 'O'
    else left(btrim(name), 1)
         || repeat('O', char_length(btrim(name)) - 2)
         || right(btrim(name), 1)
  end;
$$;

-- 익명 접근 전용 뷰: 마스킹된 이름만, 준비사항·PIN 해시 없음
--
-- security_invoker 를 켜지 않는다(기본값 false).
-- 뷰가 소유자 권한으로 실행되어야 원본 테이블 RLS(전면 차단)를 통과해
-- "마스킹된 열만" 익명에게 보여줄 수 있다. 원본 테이블 직접 접근은 여전히 막힌다.
create or replace view public.reservations_public as
select
  id,
  room_id,
  date,
  period_no,
  subject,
  public.mask_name(teacher_name) as masked_name,
  grade,
  class_no,
  device,
  (notes is not null and btrim(notes) <> '') as has_notes,
  needs_ai_coordinator
from public.reservations
where status = 'active';

-- ---------------------------------------------------------------------
-- RLS: 익명 키는 원본 테이블에 접근할 수 없다.
--      쓰기는 모두 서버(서비스 키)에서만 수행한다.
-- ---------------------------------------------------------------------
alter table public.reservations     enable row level security;
alter table public.fixed_blocks     enable row level security;
alter table public.fixed_exceptions enable row level security;
alter table public.holidays         enable row level security;
alter table public.settings         enable row level security;
alter table public.admin_config     enable row level security;
alter table public.audit_logs       enable row level security;

-- 정책을 하나도 만들지 않으면 anon/authenticated 는 아무 행도 볼 수 없다.
-- (service_role 키는 RLS를 우회하므로 서버 코드만 원본에 접근한다.)

-- 현황판이 직접 Supabase 를 구독할 때를 대비해, 읽기 전용 정보만 공개한다.
drop policy if exists fixed_blocks_read on public.fixed_blocks;
create policy fixed_blocks_read on public.fixed_blocks
  for select to anon, authenticated using (is_active);

drop policy if exists fixed_exceptions_read on public.fixed_exceptions;
create policy fixed_exceptions_read on public.fixed_exceptions
  for select to anon, authenticated using (true);

drop policy if exists holidays_read on public.holidays;
create policy holidays_read on public.holidays
  for select to anon, authenticated using (true);

-- reservations 원본에는 정책을 만들지 않는다 → anon/authenticated 는 한 행도 볼 수 없다.
-- 권한 자체도 회수해 실수로 노출되지 않게 한다.
revoke all on public.reservations from anon, authenticated;
revoke all on public.admin_config from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

-- 익명에게는 마스킹 뷰만 열어준다.
grant select on public.reservations_public to anon, authenticated;

-- ---------------------------------------------------------------------
-- 기본 설정값
-- ---------------------------------------------------------------------
insert into public.settings (key, value) values
  ('periods', '[
     {"no":1,"start":"08:50","end":"09:35"},
     {"no":2,"start":"09:45","end":"10:30"},
     {"no":3,"start":"10:40","end":"11:25"},
     {"no":4,"start":"11:35","end":"12:20"},
     {"no":5,"start":"13:20","end":"14:05"},
     {"no":6,"start":"14:15","end":"15:00"},
     {"no":7,"start":"15:10","end":"15:55"}
   ]'::jsonb),
  ('weekday_max_period', '{"1":6,"2":7,"3":6,"4":7,"5":6}'::jsonb),
  ('class_count', '{"1":4,"2":4,"3":4}'::jsonb),
  ('booking_weeks_ahead', '3'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 학년도 종료 후 익명화 (관리자 페이지에서 호출 예정)
-- ---------------------------------------------------------------------
create or replace function public.anonymize_reservations(before_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.reservations
     set teacher_name  = '(익명)',
         notes         = null,
         is_anonymized = true,
         updated_at    = now()
   where date < before_date
     and is_anonymized = false;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

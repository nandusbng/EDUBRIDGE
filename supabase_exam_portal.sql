-- EXAMS TABLE
create table if not exists public.exams (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone null default now(),
  faculty_id uuid references auth.users (id) not null,
  faculty_name text,
  title text not null,
  description text,
  subject text not null,
  exam_date date not null,
  duration_minutes integer not null,
  instructions text,
  target_audience text not null, -- 'slow_learners', 'specific', 'mentors'
  target_user_ids jsonb, -- array of uuids if specific
  questions jsonb not null, -- array of question objects: {id, text, options:[], answer, marks}
  total_marks integer not null default 0,
  is_active boolean default true,
  constraint exams_pkey primary key (id)
);

-- EXAM ATTEMPTS TABLE (Results & Cheating logs)
create table if not exists public.exam_attempts (
  id uuid not null default gen_random_uuid (),
  exam_id uuid references public.exams (id) not null,
  student_id uuid references auth.users (id) not null,
  student_name text,
  student_email text,
  student_reg_no text,
  student_class text,
  started_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone,
  answers jsonb, -- array of {question_id, selected_answer}
  score integer,
  inactivity_count integer default 0,
  status text not null default 'in_progress', -- 'in_progress', 'submitted', 'evaluated'
  constraint exam_attempts_pkey primary key (id)
);

-- Enable RLS
alter table public.exams enable row level security;
alter table public.exam_attempts enable row level security;

-- Alter existing table to add columns in case it already exists
alter table if exists public.exam_attempts
add column if not exists student_name text,
add column if not exists student_email text,
add column if not exists student_reg_no text,
add column if not exists student_class text;

-- Policies for exams
create policy "Faculty can manage their exams" on public.exams for all using (auth.uid() = faculty_id);
create policy "Users can view exams" on public.exams for select using (true); -- Can be restricted more later

-- Policies for exam attempts
create policy "Users can manage their own attempts" on public.exam_attempts for all using (auth.uid() = student_id);
create policy "Faculty can view attempts for their exams" on public.exam_attempts for select using (
  exists (select 1 from public.exams e where e.id = exam_attempts.exam_id and e.faculty_id = auth.uid())
);
create policy "Faculty can update attempts for their exams" on public.exam_attempts for update using (
  exists (select 1 from public.exams e where e.id = exam_attempts.exam_id and e.faculty_id = auth.uid())
);

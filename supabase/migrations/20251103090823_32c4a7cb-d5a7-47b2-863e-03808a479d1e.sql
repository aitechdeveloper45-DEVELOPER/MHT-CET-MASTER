-- Create table to store generated questions
CREATE TABLE IF NOT EXISTS public.test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer INTEGER NOT NULL,
  explanation TEXT,
  topic TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table to track which questions users have seen
CREATE TABLE IF NOT EXISTS public.user_seen_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.test_questions(id) ON DELETE CASCADE,
  seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, question_id)
);

-- Enable RLS
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_seen_questions ENABLE ROW LEVEL SECURITY;

-- RLS policies for test_questions (all users can read)
CREATE POLICY "Anyone can view questions"
ON public.test_questions FOR SELECT
USING (true);

-- RLS policies for user_seen_questions
CREATE POLICY "Users can view their own seen questions"
ON public.user_seen_questions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own seen questions"
ON public.user_seen_questions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_user_seen_questions_user_id ON public.user_seen_questions(user_id);
CREATE INDEX idx_test_questions_subject_difficulty ON public.test_questions(subject, difficulty);
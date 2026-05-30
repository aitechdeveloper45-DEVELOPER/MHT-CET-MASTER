-- Create user_stats table to track overall progress
CREATE TABLE public.user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_streak INTEGER DEFAULT 0,
  last_study_date DATE,
  overall_accuracy DECIMAL(5,2) DEFAULT 0,
  total_tests INTEGER DEFAULT 0,
  study_time_minutes INTEGER DEFAULT 0,
  rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create subject_progress table
CREATE TABLE public.subject_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  progress_percentage INTEGER DEFAULT 0,
  tests_completed INTEGER DEFAULT 0,
  accuracy DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subject_name)
);

-- Create test_results table
CREATE TABLE public.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  time_taken_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create weekly_goals table
CREATE TABLE public.weekly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_title TEXT NOT NULL,
  current_value INTEGER DEFAULT 0,
  target_value INTEGER NOT NULL,
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_stats
CREATE POLICY "Users can view own stats"
  ON public.user_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats"
  ON public.user_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats"
  ON public.user_stats FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for subject_progress
CREATE POLICY "Users can view own progress"
  ON public.subject_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.subject_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.subject_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for test_results
CREATE POLICY "Users can view own results"
  ON public.test_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own results"
  ON public.test_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for weekly_goals
CREATE POLICY "Users can view own goals"
  ON public.weekly_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON public.weekly_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON public.weekly_goals FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to initialize new user data
CREATE OR REPLACE FUNCTION public.initialize_user_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Initialize user stats
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id);
  
  -- Initialize default subjects
  INSERT INTO public.subject_progress (user_id, subject_name)
  VALUES 
    (NEW.id, 'Physics'),
    (NEW.id, 'Chemistry'),
    (NEW.id, 'Mathematics');
  
  -- Initialize default weekly goals
  INSERT INTO public.weekly_goals (user_id, goal_title, target_value, week_start)
  VALUES 
    (NEW.id, 'Complete 5 tests', 5, CURRENT_DATE),
    (NEW.id, 'Maintain 80% accuracy', 80, CURRENT_DATE),
    (NEW.id, 'Study 15 hours', 15, CURRENT_DATE);
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-initialize user data on signup
CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_data();
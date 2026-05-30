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

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_stats TO authenticated;
GRANT ALL ON public.user_stats TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_progress TO authenticated;
GRANT ALL ON public.subject_progress TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_results TO authenticated;
GRANT ALL ON public.test_results TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_goals TO authenticated;
GRANT ALL ON public.weekly_goals TO service_role;

CREATE POLICY "Users can view own stats" ON public.user_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stats" ON public.user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stats" ON public.user_stats FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own progress" ON public.subject_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.subject_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.subject_progress FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own results" ON public.test_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own results" ON public.test_results FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own goals" ON public.weekly_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.weekly_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.weekly_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.weekly_goals FOR DELETE USING (auth.uid() = user_id);

-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Only admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Profiles
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  name text,
  email text,
  class text,
  phone_number text,
  college_name text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own profile" ON public.profiles FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-init triggers
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.initialize_user_data()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.subject_progress (user_id, subject_name) VALUES
    (NEW.id, 'Physics'), (NEW.id, 'Chemistry'), (NEW.id, 'Mathematics')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.weekly_goals (user_id, goal_title, target_value, week_start) VALUES
    (NEW.id, 'Complete 5 tests', 5, CURRENT_DATE),
    (NEW.id, 'Maintain 80% accuracy', 80, CURRENT_DATE),
    (NEW.id, 'Study 15 hours', 15, CURRENT_DATE);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();
CREATE TRIGGER on_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.initialize_user_data();

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can view their own avatar" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Test questions
CREATE TABLE public.test_questions (
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

CREATE TABLE public.user_seen_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.test_questions(id) ON DELETE CASCADE,
  seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, question_id)
);

ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_seen_questions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_questions TO authenticated;
GRANT ALL ON public.test_questions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_seen_questions TO authenticated;
GRANT ALL ON public.user_seen_questions TO service_role;

CREATE POLICY "Only admins can directly access test_questions" ON public.test_questions FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert questions" ON public.test_questions FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update questions" ON public.test_questions FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete questions" ON public.test_questions FOR DELETE USING (public.is_admin());

CREATE POLICY "Users can view own seen questions" ON public.user_seen_questions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own seen questions" ON public.user_seen_questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own seen questions" ON public.user_seen_questions FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.check_answer(question_id uuid, user_answer integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE correct_ans integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT correct_answer INTO correct_ans FROM public.test_questions WHERE id = question_id;
  RETURN (user_answer = correct_ans);
END; $$;

CREATE OR REPLACE FUNCTION public.get_test_questions(question_ids uuid[])
RETURNS TABLE (id uuid, question_text text, options jsonb, subject text, difficulty text, topic text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  RETURN QUERY SELECT tq.id, tq.question_text, tq.options, tq.subject, tq.difficulty, tq.topic
    FROM public.test_questions tq WHERE tq.id = ANY(question_ids);
END; $$;

CREATE OR REPLACE FUNCTION public.get_public_test_questions(question_ids uuid[] DEFAULT NULL)
RETURNS TABLE(id uuid, question_text text, options jsonb, subject text, difficulty text, topic text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF question_ids IS NOT NULL THEN
    RETURN QUERY SELECT tq.id, tq.question_text, tq.options, tq.subject, tq.difficulty, tq.topic, tq.created_at
      FROM public.test_questions tq WHERE tq.id = ANY(question_ids);
  ELSE
    RETURN QUERY SELECT tq.id, tq.question_text, tq.options, tq.subject, tq.difficulty, tq.topic, tq.created_at
      FROM public.test_questions tq;
  END IF;
END; $$;

-- topic progress
CREATE TABLE public.topic_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  topic_name TEXT NOT NULL,
  questions_attempted INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, subject, topic_name)
);
ALTER TABLE public.topic_progress ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_progress TO authenticated;
GRANT ALL ON public.topic_progress TO service_role;
CREATE POLICY "Users can view own topic progress" ON public.topic_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own topic progress" ON public.topic_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own topic progress" ON public.topic_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own topic progress" ON public.topic_progress FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_topic_progress_updated_at BEFORE UPDATE ON public.topic_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_test_results_user_created ON public.test_results(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_subject ON public.test_results(subject);
CREATE INDEX IF NOT EXISTS idx_topic_progress_user_subject ON public.topic_progress(user_id, subject);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON public.user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_test_questions_subject_difficulty ON public.test_questions(subject, difficulty);
CREATE INDEX IF NOT EXISTS idx_test_questions_topic ON public.test_questions(topic);
CREATE INDEX IF NOT EXISTS idx_user_seen_questions_user_question ON public.user_seen_questions(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_weekly_goals_user_week ON public.weekly_goals(user_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_subject_progress_user ON public.subject_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
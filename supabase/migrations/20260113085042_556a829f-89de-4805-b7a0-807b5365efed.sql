-- Performance indexes for handling lakhs of users

-- Index for faster test results queries by user and date
CREATE INDEX IF NOT EXISTS idx_test_results_user_created 
ON public.test_results(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_results_subject 
ON public.test_results(subject);

-- Index for faster topic progress lookups
CREATE INDEX IF NOT EXISTS idx_topic_progress_user_subject 
ON public.topic_progress(user_id, subject);

-- Index for faster user stats lookups
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id 
ON public.user_stats(user_id);

-- Index for faster question queries by subject and difficulty
CREATE INDEX IF NOT EXISTS idx_test_questions_subject_difficulty 
ON public.test_questions(subject, difficulty);

CREATE INDEX IF NOT EXISTS idx_test_questions_topic 
ON public.test_questions(topic);

-- Index for seen questions to prevent duplicates efficiently
CREATE INDEX IF NOT EXISTS idx_user_seen_questions_user_question 
ON public.user_seen_questions(user_id, question_id);

-- Index for weekly goals by user and week
CREATE INDEX IF NOT EXISTS idx_weekly_goals_user_week 
ON public.weekly_goals(user_id, week_start DESC);

-- Index for subject progress by user
CREATE INDEX IF NOT EXISTS idx_subject_progress_user 
ON public.subject_progress(user_id);

-- Index for profiles lookup
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON public.profiles(user_id);
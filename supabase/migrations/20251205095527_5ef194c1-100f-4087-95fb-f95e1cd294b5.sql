-- Create table to track progress per syllabus topic
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

-- Enable RLS
ALTER TABLE public.topic_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own topic progress"
ON public.topic_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own topic progress"
ON public.topic_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own topic progress"
ON public.topic_progress FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_topic_progress_updated_at
BEFORE UPDATE ON public.topic_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
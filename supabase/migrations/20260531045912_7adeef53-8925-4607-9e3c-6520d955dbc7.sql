CREATE TABLE public.mentor_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.mentor_messages TO authenticated;
GRANT ALL ON public.mentor_messages TO service_role;

ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mentor messages" ON public.mentor_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own mentor messages" ON public.mentor_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own mentor messages" ON public.mentor_messages
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_mentor_messages_user_created ON public.mentor_messages(user_id, created_at);
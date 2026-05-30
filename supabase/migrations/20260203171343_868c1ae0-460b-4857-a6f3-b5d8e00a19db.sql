-- Add DELETE policies for user-managed data tables

-- Allow users to delete their own weekly goals
CREATE POLICY "Users can delete own goals"
ON public.weekly_goals
FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to delete their own topic progress
CREATE POLICY "Users can delete own topic progress"
ON public.topic_progress
FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to clear their question history
CREATE POLICY "Users can delete own seen questions"
ON public.user_seen_questions
FOR DELETE
USING (auth.uid() = user_id);
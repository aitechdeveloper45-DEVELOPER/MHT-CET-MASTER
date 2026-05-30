-- ===========================================
-- FIX 1: Test Questions Answer Exposure
-- Create a secure view that hides correct_answer and explanation
-- ===========================================

-- Create a view that excludes sensitive fields (correct_answer, explanation)
CREATE VIEW public.test_questions_public
WITH (security_invoker = on) AS
SELECT 
  id,
  question_text,
  options,
  subject,
  difficulty,
  topic,
  created_at
FROM public.test_questions;

-- Drop the existing SELECT policy that exposes answers
DROP POLICY IF EXISTS "Authenticated users can view questions" ON public.test_questions;

-- Create a new restrictive policy - only admins can directly access test_questions
CREATE POLICY "Only admins can directly access test_questions"
ON public.test_questions
FOR SELECT
USING (public.is_admin());

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.test_questions_public TO authenticated;

-- ===========================================
-- FIX 2: Profiles Table - Add explicit anonymous denial
-- ===========================================

-- Add a policy that explicitly requires authentication for any access
-- First, drop and recreate the SELECT policy to ensure it's robust
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);
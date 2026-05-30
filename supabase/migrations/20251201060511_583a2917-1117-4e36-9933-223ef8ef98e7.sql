-- Fix test_questions security issue - prevent answer exposure
-- Drop the insecure policy that allows anyone to view questions
DROP POLICY IF EXISTS "Anyone can view questions" ON public.test_questions;

-- Create new policy: authenticated users can view questions
CREATE POLICY "Authenticated users can view questions"
ON public.test_questions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create policy for admins to insert questions
CREATE POLICY "Admins can insert questions"
ON public.test_questions
FOR INSERT
WITH CHECK (public.is_admin());

-- Create policy for admins to update questions
CREATE POLICY "Admins can update questions"
ON public.test_questions
FOR UPDATE
USING (public.is_admin());

-- Create policy for admins to delete questions
CREATE POLICY "Admins can delete questions"
ON public.test_questions
FOR DELETE
USING (public.is_admin());

-- Create a secure view that excludes correct answers for students
CREATE OR REPLACE VIEW public.test_questions_secure AS
SELECT 
  id,
  question_text,
  options,
  subject,
  difficulty,
  topic,
  created_at,
  -- Only show correct_answer to admins
  CASE 
    WHEN public.is_admin() THEN correct_answer
    ELSE NULL
  END as correct_answer,
  explanation
FROM public.test_questions;

-- Grant access to the secure view
GRANT SELECT ON public.test_questions_secure TO authenticated;

-- Create a function to check answers securely
CREATE OR REPLACE FUNCTION public.check_answer(question_id uuid, user_answer integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  correct_ans integer;
BEGIN
  -- Only authenticated users can check answers
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get the correct answer
  SELECT correct_answer INTO correct_ans
  FROM public.test_questions
  WHERE id = question_id;
  
  -- Return whether the answer is correct
  RETURN (user_answer = correct_ans);
END;
$$;

-- Create a function to get questions without answers for tests
CREATE OR REPLACE FUNCTION public.get_test_questions(question_ids uuid[])
RETURNS TABLE (
  id uuid,
  question_text text,
  options jsonb,
  subject text,
  difficulty text,
  topic text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only authenticated users can get questions
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  RETURN QUERY
  SELECT 
    tq.id,
    tq.question_text,
    tq.options,
    tq.subject,
    tq.difficulty,
    tq.topic
  FROM public.test_questions tq
  WHERE tq.id = ANY(question_ids);
END;
$$;
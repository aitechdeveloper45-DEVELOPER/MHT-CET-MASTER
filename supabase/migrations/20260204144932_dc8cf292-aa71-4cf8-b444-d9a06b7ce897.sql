-- ===========================================
-- FIX 1: Profiles table - correct the policy logic
-- The condition should be just auth.uid() = user_id (which implicitly requires auth)
-- ===========================================

-- Drop the current policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create corrected policy - auth.uid() = user_id already ensures:
-- 1. User must be authenticated (auth.uid() returns null for unauthenticated)
-- 2. User can only see their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- ===========================================
-- FIX 2: Enable RLS on the view  
-- Views with security_invoker=on inherit RLS from base tables
-- But we need to ensure the view itself is protected
-- ===========================================

-- Enable RLS on the test_questions_public view
-- Note: For views with security_invoker=on, RLS applies from the base table
-- Since we restricted base table to admins only, we need to create a function
-- that allows authenticated users to get questions through the view

-- First, create a function that returns questions securely (without answers)
CREATE OR REPLACE FUNCTION public.get_public_test_questions(question_ids uuid[] DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  question_text text,
  options jsonb,
  subject text,
  difficulty text,
  topic text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only authenticated users can access
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- If specific IDs provided, return those
  IF question_ids IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      tq.id,
      tq.question_text,
      tq.options,
      tq.subject,
      tq.difficulty,
      tq.topic,
      tq.created_at
    FROM public.test_questions tq
    WHERE tq.id = ANY(question_ids);
  ELSE
    -- Return all questions (for browsing)
    RETURN QUERY
    SELECT 
      tq.id,
      tq.question_text,
      tq.options,
      tq.subject,
      tq.difficulty,
      tq.topic,
      tq.created_at
    FROM public.test_questions tq;
  END IF;
END;
$$;

-- Drop the view since we'll use the function instead
DROP VIEW IF EXISTS public.test_questions_public;
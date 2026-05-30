-- Remove the SECURITY DEFINER view that was flagged by the linter
DROP VIEW IF EXISTS public.test_questions_secure;

-- The security is now properly handled through:
-- 1. RLS policies that require authentication to view questions
-- 2. The get_test_questions() function that returns questions without answers
-- 3. The check_answer() function that validates answers server-side

-- This approach is more secure as it:
-- - Doesn't bypass RLS policies
-- - Provides granular control over what data is exposed
-- - Prevents direct access to correct answers
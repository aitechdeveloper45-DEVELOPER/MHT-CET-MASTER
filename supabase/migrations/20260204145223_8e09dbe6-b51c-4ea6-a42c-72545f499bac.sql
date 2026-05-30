-- ===========================================
-- FIX: Add DELETE policy for profiles table
-- Users should be able to delete their own profile data (GDPR compliance)
-- ===========================================

CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = user_id);
-- Add explicit DELETE policy for user_stats that only allows admins
-- This prevents users from deleting their own performance statistics
-- and makes the security posture explicit

CREATE POLICY "Only admins can delete user stats"
ON public.user_stats
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Add comment to document the security decision
COMMENT ON POLICY "Only admins can delete user stats" ON public.user_stats IS 
'Prevents users from deleting their own performance statistics. Only admins can delete stats for data management purposes.';
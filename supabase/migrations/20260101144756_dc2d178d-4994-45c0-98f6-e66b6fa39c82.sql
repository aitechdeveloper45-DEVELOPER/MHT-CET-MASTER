-- Add DELETE policy for test_results table
-- Only admins can delete test results (students cannot manipulate their academic records)
CREATE POLICY "Only admins can delete test results"
ON public.test_results
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Add UPDATE policy to prevent score modification
-- Test results should be immutable once created
CREATE POLICY "Prevent test result modification"
ON public.test_results
FOR UPDATE
USING (false);
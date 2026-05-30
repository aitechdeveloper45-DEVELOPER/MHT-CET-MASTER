-- Add DELETE policy for subject_progress table
-- Only admins can delete progress records (students cannot manipulate their academic records)
CREATE POLICY "Only admins can delete subject progress"
ON public.subject_progress
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));
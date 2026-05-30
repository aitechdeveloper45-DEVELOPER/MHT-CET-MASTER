-- Create trigger to automatically create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- Also ensure existing users have profiles (backfill)
INSERT INTO public.profiles (user_id, email)
SELECT id, email
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles);
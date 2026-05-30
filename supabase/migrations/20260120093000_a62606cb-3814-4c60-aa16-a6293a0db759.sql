-- Add phone_number and college_name columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS college_name text;

-- Drop address column since we're replacing it with college_name
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS address;
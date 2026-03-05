-- 1. Create a table for allowed users
CREATE TABLE IF NOT EXISTS public.allowed_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Create a function to check if the user is allowed
CREATE OR REPLACE FUNCTION public.check_allowed_user()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.allowed_users 
    WHERE email = NEW.email
  ) THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Signup not allowed: % is not in the allowed users list.', NEW.email;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a trigger on auth.users (Before Insert)
-- This blocks account creation if the email is not in allowed_users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.check_allowed_user();

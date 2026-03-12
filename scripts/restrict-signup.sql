-- 1. Create a table for allowed users
CREATE TABLE IF NOT EXISTS public.allowed_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.check_allowed_user()
RETURNS trigger AS $$
BEGIN
  -- Allow only emails from a specific domain (e.g., @husqvarna.com)
  IF NEW.email LIKE '%@husqvarna.com' THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Signup not allowed: Only @husqvarna.com emails are permitted.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a trigger on auth.users (Before Insert)
-- This blocks account creation if the email is not in allowed_users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.check_allowed_user();

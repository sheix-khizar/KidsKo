-- Migration: Add is_admin column to profiles table for admin authorization
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Example: Grant admin access to primary account
-- UPDATE profiles SET is_admin = TRUE WHERE id = 'YOUR_PARENT_PROFILE_ID';

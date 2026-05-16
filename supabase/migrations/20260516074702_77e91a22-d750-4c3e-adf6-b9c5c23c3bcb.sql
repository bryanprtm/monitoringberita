
DO $$
DECLARE
  new_uid uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@ncc.local') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_uid,
      'authenticated',
      'authenticated',
      'admin@ncc.local',
      crypt('admin123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('username','admin','display_name','Administrator'),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), new_uid, jsonb_build_object('sub', new_uid::text, 'email', 'admin@ncc.local'), 'email', new_uid::text, now(), now(), now());

    INSERT INTO public.profiles (id, username, display_name)
    VALUES (new_uid, 'admin', 'Administrator')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (new_uid, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

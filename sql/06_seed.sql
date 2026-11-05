-- Demo accounts (passwords hashed with bcrypt by pgcrypto)
--   admin@notevault.dev   / admin12345
--   student@notevault.dev / student12345

INSERT INTO users (name, email, password_hash, role)
VALUES ('Admin', 'admin@notevault.dev', crypt('admin12345', gen_salt('bf', 10)), 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash;

INSERT INTO users (name, email, password_hash, role)
VALUES ('Demo Student', 'student@notevault.dev', crypt('student12345', gen_salt('bf', 10)), 'user')
ON CONFLICT (email) DO NOTHING;

INSERT INTO folders (user_id, name)
SELECT id, 'DBMS' FROM users WHERE email = 'student@notevault.dev'
ON CONFLICT (user_id, name) DO NOTHING;

INSERT INTO folders (user_id, name)
SELECT id, 'Operating Systems' FROM users WHERE email = 'student@notevault.dev'
ON CONFLICT (user_id, name) DO NOTHING;

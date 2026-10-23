INSERT INTO organizations (name)
VALUES ('Root Organization')
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (organization_id, email, password_hash, role)
SELECT o.id,
       'root@example.com',
       crypt('admin123', gen_salt('bf', 12)),
       'root'
FROM organizations o
WHERE o.name = 'Root Organization'
ON CONFLICT (email) DO NOTHING;

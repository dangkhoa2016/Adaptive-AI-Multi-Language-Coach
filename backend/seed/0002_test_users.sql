-- Seed: test users for role-based tests
INSERT OR IGNORE INTO users (id, email, email_verified, role) VALUES
('test-admin-id', 'admin@test.com', 1, 'admin'),
('test-user-id', 'user@test.com', 1, 'user')

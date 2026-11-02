-- 012_demo_salesperson.sql (DEMO / TEST ONLY) - Supabase SQL Editor me Run kijiye
INSERT INTO profiles (id, business_id, email, mobile, phone, contact_no, name, full_name, role, profile_type, sales_role_type, trade_scope, password_hash, assigned_company_ids, assigned_category_ids, category_access_mode, active, status)
SELECT 'p-demo-salesman', 'biz-saifee', '9000000099@sales_dist.saifee.local', '9000000099', '9000000099', '9000000099', 'Demo Salesman (Test)', 'Demo Salesman (Test)', 'sales_dist', 'SALESPERSON', 'DISTRIBUTOR', 'ALL', '$2a$10$nSp8Tt.YLLYe8DNuqj5i7OTSTcJBHm0Z7YrevWku8bWCbaz3rF7Za', '[]'::jsonb, '[]'::jsonb, 'all', true, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id = 'p-demo-salesman');
SELECT id, name, mobile, role, status FROM profiles WHERE id = 'p-demo-salesman';

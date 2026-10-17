BEGIN;

SELECT plan(26);

-- ============================================================================
-- Setup for T-1.17 Shop Settings (Scenario S22)
-- ============================================================================

SELECT tests.create_supabase_user(
    'admin_s22',
    'admin_s22@example.com',
    '01011110022',
    '{"full_name": "Admin S22"}'::jsonb
);

SELECT tests.create_supabase_user(
    'customer_s22',
    'customer_s22@example.com',
    '01022220022',
    '{"full_name": "Customer S22"}'::jsonb
);

-- Promote admin_s22 to admin as database owner
UPDATE public.profiles
   SET role = 'admin'
 WHERE id = tests.get_supabase_uid('admin_s22');

-- ============================================================================
-- 1. Read visibility / RLS: public keys vs private keys
-- ============================================================================

-- 1. Anon reads public settings
SELECT tests.clear_authentication();
SELECT cmp_ok(
    (SELECT count(*)::bigint FROM public.shop_settings),
    '>=',
    13::bigint,
    'S22: Anon can read public settings'
);

-- 2. Anon CANNOT read private settings
SELECT is(
    (SELECT count(*)::bigint FROM public.shop_settings WHERE is_public = false),
    0::bigint,
    'S22: Anon cannot read private settings (0 rows returned)'
);

-- 3. Customer reads public settings
SELECT tests.authenticate_as('customer_s22');
SELECT cmp_ok(
    (SELECT count(*)::bigint FROM public.shop_settings),
    '>=',
    13::bigint,
    'S22: Customer can read public settings'
);

-- 4. Customer CANNOT read private settings
SELECT is(
    (SELECT count(*)::bigint FROM public.shop_settings WHERE is_public = false),
    0::bigint,
    'S22: Customer cannot read private settings (0 rows returned)'
);

-- 5. Customer direct UPDATE is blocked by permissions
SELECT throws_ok(
    $$UPDATE public.shop_settings SET value = '"Hacked"'::jsonb WHERE key = 'shop_name_en'$$,
    '42501',
    NULL,
    'S22: Customer direct UPDATE on shop_settings is denied'
);

-- 6. Admin at aal1 CANNOT read private settings
SELECT tests.authenticate_as('admin_s22', 'aal1');
SELECT is(
    (SELECT count(*)::bigint FROM public.shop_settings WHERE is_public = false),
    0::bigint,
    'S22: Admin at aal1 cannot read private settings'
);

-- 7. Admin at aal2 CAN read ALL settings (including private settings)
SELECT tests.authenticate_as('admin_s22', 'aal2');
SELECT is(
    (SELECT count(*)::bigint FROM public.shop_settings),
    19::bigint,
    'S22: Admin at aal2 can read all 19 settings including private'
);

-- ============================================================================
-- 2. Access control on admin_update_setting
-- ============================================================================

-- 8. Customer calling admin_update_setting raises ADM-001 (42501)
SELECT tests.authenticate_as('customer_s22');
SELECT throws_ok(
    $$SELECT public.admin_update_setting('sale_percent', '20'::jsonb)$$,
    '42501',
    'Admins only',
    'S22: Customer calling admin_update_setting raises ADM-001'
);

-- 9. Admin at aal1 calling admin_update_setting raises ADM-002 (42501)
SELECT tests.authenticate_as('admin_s22', 'aal1');
SELECT throws_ok(
    $$SELECT public.admin_update_setting('sale_percent', '20'::jsonb)$$,
    '42501',
    'Two-factor authentication required for admin actions',
    'S22: Admin at aal1 calling admin_update_setting raises ADM-002'
);

-- Switch to admin at aal2 for all subsequent updates
SELECT tests.authenticate_as('admin_s22', 'aal2');

-- ============================================================================
-- 3. Key allow-list and typed validation
-- ============================================================================

-- 10. Unknown key rejected with ADM-008 (42501)
SELECT throws_ok(
    $$SELECT public.admin_update_setting('disallowed_key', '"any"'::jsonb)$$,
    '42501',
    'Setting key not allowed',
    'S22: Unknown setting key rejected with ADM-008'
);

-- 11. sale_percent negative rejected with ADM-007 (22023)
SELECT throws_ok(
    $$SELECT public.admin_update_setting('sale_percent', '-5'::jsonb)$$,
    '22023',
    'Invalid setting value',
    'S22: Negative sale_percent rejected with ADM-007'
);

-- 12. sale_percent > 90 rejected with ADM-007 (22023)
SELECT throws_ok(
    $$SELECT public.admin_update_setting('sale_percent', '95'::jsonb)$$,
    '22023',
    'Invalid setting value',
    'S22: sale_percent > 90 rejected with ADM-007'
);

-- 13. sale_percent as string rejected with ADM-007 (22023)
SELECT throws_ok(
    $$SELECT public.admin_update_setting('sale_percent', '"50"'::jsonb)$$,
    '22023',
    'Invalid setting value',
    'S22: sale_percent string value rejected with ADM-007'
);

-- 14. shop_name_en empty string rejected with ADM-007 (22023)
SELECT throws_ok(
    $$SELECT public.admin_update_setting('shop_name_en', '""'::jsonb)$$,
    '22023',
    'Invalid setting value',
    'S22: Empty shop_name_en rejected with ADM-007'
);

-- 15. shop_name_en > 60 chars rejected with ADM-007 (22023)
SELECT throws_ok(
    format($$SELECT public.admin_update_setting('shop_name_en', to_jsonb('%s'::text))$$, repeat('X', 61)),
    '22023',
    'Invalid setting value',
    'S22: shop_name_en > 60 chars rejected with ADM-007'
);

-- 16. instagram invalid URL rejected with ADM-007 (22023)
SELECT throws_ok(
    $$SELECT public.admin_update_setting('instagram', '"http://not-secure.com"'::jsonb)$$,
    '22023',
    'Invalid setting value',
    'S22: Non-https instagram URL rejected with ADM-007'
);

-- 17. payment_methods_enabled invalid method rejected with ADM-007 (22023)
SELECT throws_ok(
    $$SELECT public.admin_update_setting('payment_methods_enabled', '["cod", "crypto"]'::jsonb)$$,
    '22023',
    'Invalid setting value',
    'S22: Invalid payment method in payment_methods_enabled rejected'
);

-- 18. payment_window_hours > 72 rejected with ADM-007 (22023)
SELECT throws_ok(
    $$SELECT public.admin_update_setting('payment_window_hours', '100'::jsonb)$$,
    '22023',
    'Invalid setting value',
    'S22: payment_window_hours > 72 rejected with ADM-007'
);

-- 19. pending_order_limit < 1 rejected with ADM-007 (22023)
SELECT throws_ok(
    $$SELECT public.admin_update_setting('pending_order_limit', '0'::jsonb)$$,
    '22023',
    'Invalid setting value',
    'S22: pending_order_limit < 1 rejected with ADM-007'
);

-- ============================================================================
-- 4. Valid updates succeed and are audited
-- ============================================================================

-- 20. Valid update of sale_percent succeeds
SELECT lives_ok(
    $$SELECT public.admin_update_setting('sale_percent', '40'::jsonb)$$,
    'S22: Admin can update sale_percent to 40'
);

-- 21. Setting value is updated in table
SELECT is(
    (SELECT value::text FROM public.shop_settings WHERE key = 'sale_percent'),
    '40',
    'S22: sale_percent value updated in shop_settings table'
);

-- 22. Setting change appears in audit_log
SELECT ok(
    EXISTS (
        SELECT 1 FROM public.audit_log
         WHERE entity = 'shop_settings'
           AND entity_id = 'sale_percent'
           AND action = 'UPDATE'
           AND (old ->> 'value') = '50'
           AND (new ->> 'value') = '40'
    ),
    'S22: Setting update appears in audit_log with old and new values'
);

-- 23. Valid update of private setting payment_window_hours succeeds
SELECT lives_ok(
    $$SELECT public.admin_update_setting('payment_window_hours', '48'::jsonb)$$,
    'S22: Admin can update private setting payment_window_hours'
);

-- 24. Private setting value is updated in table
SELECT is(
    (SELECT value::text FROM public.shop_settings WHERE key = 'payment_window_hours'),
    '48',
    'S22: payment_window_hours updated in shop_settings table'
);

-- ============================================================================
-- 5. Storage bucket product-images limits
-- ============================================================================

SELECT tests.authenticate_as_service_role();

-- 25. product-images file_size_limit is 3 MB (3145728 bytes)
SELECT is(
    (SELECT file_size_limit FROM storage.buckets WHERE id = 'product-images'),
    3145728::bigint,
    'S22: product-images bucket file_size_limit is 3 MB'
);

-- 26. product-images allowed_mime_types allows JPEG, PNG, WebP
SELECT is(
    (SELECT allowed_mime_types FROM storage.buckets WHERE id = 'product-images'),
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[],
    'S22: product-images bucket allowed_mime_types restricted to JPEG, PNG, WebP'
);

SELECT * FROM finish();
ROLLBACK;

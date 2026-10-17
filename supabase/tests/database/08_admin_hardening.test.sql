BEGIN;

SELECT plan(30);

-- ============================================================================
-- Setup for T-1.15 Admin Hardening (S19, S20, S30)
-- ============================================================================

INSERT INTO public.delivery_fees (governorate_id, method, fee)
VALUES (1, 'representative', 35.00)
ON CONFLICT (governorate_id, method) DO NOTHING;

SELECT tests.create_supabase_user(
    'admin_s19',
    'admin_s19@example.com',
    '01011110019',
    '{"full_name": "Admin S19"}'::jsonb
);

SELECT tests.create_supabase_user(
    'customer_s19',
    'customer_s19@example.com',
    '01022220019',
    '{"full_name": "Customer S19"}'::jsonb
);

-- Promote admin_s19 to admin as owner
UPDATE public.profiles
   SET role = 'admin'
 WHERE id = tests.get_supabase_uid('admin_s19');

-- Place an order as customer_s19 so orders exist in the database
SELECT tests.authenticate_as('customer_s19');

SELECT public.place_order(
    jsonb_build_array(
        jsonb_build_object(
            'product_id', (SELECT id FROM public.products WHERE is_active LIMIT 1),
            'quantity', 1
        )
    ),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Customer S19', 'phone', '01022220019', 'governorate_id', 1::smallint, 'city', 'Cairo', 'address', 'Order Street', 'notes', NULL)
);

-- ============================================================================
-- Scenario S19: Admin at aal1 vs aal2; customer refused
-- ============================================================================

-- 1. Admin at aal1 reads zero rows under admin RLS
SELECT tests.authenticate_as('admin_s19', 'aal1');

SELECT is(
    (SELECT count(*)::bigint FROM public.orders),
    0::bigint,
    'S19: Admin at aal1 sees 0 orders under admin RLS'
);

-- 2. Admin at aal1 calling admin_dashboard raises 42501 (ADM-002)
SELECT throws_ok(
    'SELECT public.admin_dashboard()',
    '42501',
    'Two-factor authentication required for admin actions',
    'S19: Admin at aal1 calling admin_dashboard raises ADM-002'
);

-- 3. Admin at aal1 calling require_admin() raises 42501 (ADM-002)
SELECT throws_ok(
    'SELECT public.require_admin()',
    '42501',
    'Two-factor authentication required for admin actions',
    'S19: Admin at aal1 calling require_admin raises ADM-002'
);

-- 4. Admin at aal2 reads all rows under admin RLS
SELECT tests.authenticate_as('admin_s19', 'aal2');

SELECT cmp_ok(
    (SELECT count(*)::bigint FROM public.orders),
    '>',
    0::bigint,
    'S19: Admin at aal2 sees orders under admin RLS'
);

-- 5. Admin at aal2 calling admin_dashboard succeeds
SELECT ok(
    (SELECT public.admin_dashboard() IS NOT NULL),
    'S19: Admin at aal2 calling admin_dashboard succeeds'
);

-- 6. Admin at aal2 calling require_admin() executes without error
SELECT lives_ok(
    'SELECT public.require_admin()',
    'S19: Admin at aal2 calling require_admin succeeds'
);

-- 7. Customer calling admin_dashboard raises 42501 (ADM-001)
SELECT tests.authenticate_as('customer_s19');

SELECT throws_ok(
    'SELECT public.admin_dashboard()',
    '42501',
    'Admins only',
    'S19: Customer calling admin_dashboard raises ADM-001'
);

-- 8. Customer calling require_admin() raises 42501 (ADM-001)
SELECT throws_ok(
    'SELECT public.require_admin()',
    '42501',
    'Admins only',
    'S19: Customer calling require_admin raises ADM-001'
);

-- ============================================================================
-- Scenario S20: admin_set_role removed, role modification trigger, owner promotion
-- ============================================================================

-- 9. admin_set_role function no longer exists
SELECT hasnt_function(
    'public',
    'admin_set_role',
    'S20: admin_set_role function no longer exists'
);

-- 10. Customer cannot update their own role via API
SELECT tests.authenticate_as('customer_s19');
SELECT throws_ok(
    format('UPDATE public.profiles SET role = ''admin'' WHERE id = ''%s''::uuid', tests.get_supabase_uid('customer_s19')),
    '42501',
    NULL,
    'S20: Customer cannot update role via API'
);

-- 11. Admin cannot update customer role via API
SELECT tests.authenticate_as('admin_s19', 'aal2');
SELECT throws_ok(
    format('UPDATE public.profiles SET role = ''admin'' WHERE id = ''%s''::uuid', tests.get_supabase_uid('customer_s19')),
    '42501',
    NULL,
    'S20: Admin cannot update customer role via API'
);

-- Column ACL rejection is checked here; the separate regression suite grants
-- role updates temporarily to exercise the trigger independently.
-- 12. Database owner (via superuser/postgres) CAN update role directly
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);
UPDATE public.profiles
   SET role = 'admin'
 WHERE id = tests.get_supabase_uid('customer_s19');

SELECT is(
    (SELECT role::text FROM public.profiles WHERE id = tests.get_supabase_uid('customer_s19')),
    'admin',
    'S20: Database owner can promote user'
);

-- 13. Revert customer_s19 back to customer as owner
UPDATE public.profiles
   SET role = 'customer'
 WHERE id = tests.get_supabase_uid('customer_s19');

SELECT is(
    (SELECT role::text FROM public.profiles WHERE id = tests.get_supabase_uid('customer_s19')),
    'customer',
    'S20: Database owner can demote user'
);

-- ============================================================================
-- Scenario S30: Column length check constraints & sign-up metadata clamping
-- ============================================================================

-- 14. profiles.full_name > 100 rejected
SELECT throws_ok(
    format('UPDATE public.profiles SET full_name = ''%s'' WHERE id = ''%s''::uuid', repeat('a', 101), tests.get_supabase_uid('customer_s19')),
    '23514',
    NULL,
    'S30: Profile full_name > 100 characters rejected'
);

-- 15. profiles.phone > 20 rejected
SELECT throws_ok(
    format('UPDATE public.profiles SET phone = ''%s'' WHERE id = ''%s''::uuid', repeat('1', 21), tests.get_supabase_uid('customer_s19')),
    '23514',
    NULL,
    'S30: Profile phone > 20 characters rejected'
);

-- 16. profiles.city > 150 rejected
SELECT throws_ok(
    format('UPDATE public.profiles SET city = ''%s'' WHERE id = ''%s''::uuid', repeat('c', 151), tests.get_supabase_uid('customer_s19')),
    '23514',
    NULL,
    'S30: Profile city > 150 characters rejected'
);

-- 17. profiles.address > 150 rejected
SELECT throws_ok(
    format('UPDATE public.profiles SET address = ''%s'' WHERE id = ''%s''::uuid', repeat('a', 151), tests.get_supabase_uid('customer_s19')),
    '23514',
    NULL,
    'S30: Profile address > 150 characters rejected'
);

-- 18. categories.name > 100 rejected
SELECT throws_ok(
    format('INSERT INTO public.categories (name, slug) VALUES (''%s'', ''test-long-cat'')', repeat('c', 101)),
    '23514',
    NULL,
    'S30: Category name > 100 characters rejected'
);

-- 19. categories.name_ar > 100 rejected
SELECT throws_ok(
    format('INSERT INTO public.categories (name, name_ar, slug) VALUES (''Valid'', ''%s'', ''test-long-cat-ar'')', repeat('ع', 101)),
    '23514',
    NULL,
    'S30: Category name_ar > 100 characters rejected'
);

-- 20. products.name > 100 rejected
SELECT throws_ok(
    format('INSERT INTO public.products (category_id, name, price) VALUES (1, ''%s'', 50.00)', repeat('p', 101)),
    '23514',
    NULL,
    'S30: Product name > 100 characters rejected'
);

-- 21. products.name_ar > 100 rejected
SELECT throws_ok(
    format('INSERT INTO public.products (category_id, name, name_ar, price) VALUES (1, ''Valid Prod'', ''%s'', 50.00)', repeat('م', 101)),
    '23514',
    NULL,
    'S30: Product name_ar > 100 characters rejected'
);

-- 22. orders.ship_name > 100 rejected
SELECT throws_ok(
    format('INSERT INTO public.orders (delivery_method, ship_name, ship_phone, ship_governorate, ship_address, user_id, subtotal, shipping_fee, total)
            VALUES (''representative'', ''%s'', ''01011112222'', ''Cairo'', ''Street'', tests.get_supabase_uid(''customer_s19''), 10, 10, 20)', repeat('n', 101)),
    '23514',
    NULL,
    'S30: Order ship_name > 100 characters rejected'
);

-- 23. orders.ship_phone > 20 rejected
SELECT throws_ok(
    format('INSERT INTO public.orders (delivery_method, ship_name, ship_phone, ship_governorate, ship_address, user_id, subtotal, shipping_fee, total)
            VALUES (''representative'', ''Valid Name'', ''%s'', ''Cairo'', ''Street'', tests.get_supabase_uid(''customer_s19''), 10, 10, 20)', repeat('0', 21)),
    '23514',
    NULL,
    'S30: Order ship_phone > 20 characters rejected'
);

-- 24. orders.ship_governorate > 100 rejected
SELECT throws_ok(
    format('INSERT INTO public.orders (delivery_method, ship_name, ship_phone, ship_governorate, ship_address, user_id, subtotal, shipping_fee, total)
            VALUES (''representative'', ''Valid Name'', ''01011112222'', ''%s'', ''Street'', tests.get_supabase_uid(''customer_s19''), 10, 10, 20)', repeat('g', 101)),
    '23514',
    NULL,
    'S30: Order ship_governorate > 100 characters rejected'
);

-- 25. orders.ship_city > 150 rejected
SELECT throws_ok(
    format('INSERT INTO public.orders (delivery_method, ship_name, ship_phone, ship_governorate, ship_city, ship_address, user_id, subtotal, shipping_fee, total)
            VALUES (''representative'', ''Valid Name'', ''01011112222'', ''Cairo'', ''%s'', ''Street'', tests.get_supabase_uid(''customer_s19''), 10, 10, 20)', repeat('c', 151)),
    '23514',
    NULL,
    'S30: Order ship_city > 150 characters rejected'
);

-- 26. orders.ship_address > 150 rejected
SELECT throws_ok(
    format('INSERT INTO public.orders (delivery_method, ship_name, ship_phone, ship_governorate, ship_address, user_id, subtotal, shipping_fee, total)
            VALUES (''representative'', ''Valid Name'', ''01011112222'', ''Cairo'', ''%s'', tests.get_supabase_uid(''customer_s19''), 10, 10, 20)', repeat('a', 151)),
    '23514',
    NULL,
    'S30: Order ship_address > 150 characters rejected'
);

-- 27. orders.notes > 500 rejected
SELECT throws_ok(
    format('INSERT INTO public.orders (delivery_method, ship_name, ship_phone, ship_governorate, ship_address, notes, user_id, subtotal, shipping_fee, total)
            VALUES (''representative'', ''Valid Name'', ''01011112222'', ''Cairo'', ''Street'', ''%s'', tests.get_supabase_uid(''customer_s19''), 10, 10, 20)', repeat('x', 501)),
    '23514',
    NULL,
    'S30: Order notes > 500 characters rejected'
);

-- 28. Clamping: handle_new_user creates profile without error even if metadata is oversize
SELECT lives_ok(
    format($$SELECT tests.create_supabase_user(
        'oversize_s30',
        'oversize_s30@example.com',
        NULL,
        jsonb_build_object(
            'full_name', repeat('N', 150),
            'phone', repeat('9', 35)
        )
    )$$),
    'S30: Creating user with over-length metadata does not throw'
);

-- 29. Clamping: created profile full_name length clamped to exactly 100
SELECT is(
    (SELECT char_length(full_name) FROM public.profiles WHERE id = tests.get_supabase_uid('oversize_s30')),
    100,
    'S30: Profile full_name clamped to 100 chars'
);

-- 30. Clamping: created profile phone length clamped to exactly 20
SELECT is(
    (SELECT char_length(phone) FROM public.profiles WHERE id = tests.get_supabase_uid('oversize_s30')),
    20,
    'S30: Profile phone clamped to 20 chars'
);

SELECT * FROM finish();
ROLLBACK;

BEGIN;

SELECT plan(22);

-- ============================================================================
-- Setup for T-7.11 Data Subject Requests and Customer Anonymization
-- ============================================================================

SELECT tests.create_supabase_user(
    'admin_anon_user',
    'admin_anon@example.com',
    '01011119999',
    '{"full_name": "Admin Anon"}'::jsonb
);

SELECT tests.create_supabase_user(
    'target_customer_user',
    'customer_target@example.com',
    '01022228888',
    '{"full_name": "Target Customer"}'::jsonb
);

SELECT tests.create_supabase_user(
    'other_customer_user',
    'customer_other@example.com',
    '01033337777',
    '{"full_name": "Other Customer"}'::jsonb
);

-- Promote admin_anon_user to admin as database owner
UPDATE public.profiles
   SET role = 'admin'
 WHERE id = tests.get_supabase_uid('admin_anon_user');

-- Populate full address details on target_customer_user
UPDATE public.profiles
   SET phone = '01022228888',
       alt_phone = '01122228888',
       governorate_id = 1,
       city = 'مدينة نصر',
       district = 'المنطقة الأولى',
       address = 'شارع عباس العقاد عمارة 15',
       postal_code = '11511',
       floor = '3',
       apartment = '302',
       landmark = 'بجوار البنك الأهلي'
 WHERE id = tests.get_supabase_uid('target_customer_user');

-- Ensure delivery fee exists for governorate 1
INSERT INTO public.delivery_fees (governorate_id, method, fee)
VALUES (1, 'representative', 35.00)
ON CONFLICT (governorate_id, method) DO NOTHING;

-- Create test product
INSERT INTO public.products (
    category_id, name, name_ar, price, stock_quantity, is_active
) VALUES (
    (SELECT id FROM public.categories LIMIT 1),
    'Anonymize Test Bag',
    'حقيبة اختبار المجهول',
    250.00,
    20,
    true
) RETURNING id AS anon_product_id \gset

-- Place an order for target customer
SELECT tests.authenticate_as('target_customer_user', 'aal1');

SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :anon_product_id, 'quantity', 1)),
    'representative'::public.delivery_method,
    'cod'::public.payment_method,
    jsonb_build_object('postal_code', '11511',
        'name', 'Target Customer',
        'phone', '01022228888',
        'alt_phone', '01122228888',
        'governorate_id', 1,
        'city', 'مدينة نصر',
        'district', 'المنطقة الأولى',
        'address', 'شارع عباس العقاد عمارة 15',
        'floor', '3',
        'apartment', '302',
        'landmark', 'بجوار البنك الأهلي',
        'notes', 'يرجى الاتصال قبل الوصول'
    )
) AS test_order_id \gset

-- Add favorite for target customer
INSERT INTO public.favorites (user_id, product_id)
VALUES (tests.get_supabase_uid('target_customer_user'), :anon_product_id);

-- ============================================================================
-- 1. Authorization checks
-- ============================================================================

-- Test 1: Anonymous user cannot execute admin_anonymize_customer
SELECT tests.clear_authentication();
SELECT throws_ok(
    $$ SELECT public.admin_anonymize_customer('00000000-0000-0000-0000-000000000000'::uuid) $$,
    '42501',
    NULL,
    'Anonymous user cannot execute admin_anonymize_customer'
);

-- Test 2: Regular customer cannot execute admin_anonymize_customer (ADM-001)
SELECT tests.authenticate_as('other_customer_user', 'aal1');
SELECT throws_ok(
    $$ SELECT public.admin_anonymize_customer('00000000-0000-0000-0000-000000000000'::uuid) $$,
    '42501',
    'Admins only',
    'Customer receives ADM-001 when attempting to anonymize customer'
);

-- Test 3: Admin at AAL1 cannot execute admin_anonymize_customer (ADM-002)
SELECT tests.authenticate_as('admin_anon_user', 'aal1');
SELECT throws_ok(
    format('SELECT public.admin_anonymize_customer(%L::uuid)', tests.get_supabase_uid('target_customer_user')),
    '42501',
    'Two-factor authentication required for admin actions',
    'Admin at AAL1 receives ADM-002 requiring step-up'
);

-- ============================================================================
-- 2. Input validation checks
-- ============================================================================
SELECT tests.authenticate_as('admin_anon_user', 'aal2');

-- Test 4: Null customer ID is rejected (ADM-007)
SELECT throws_ok(
    $$ SELECT public.admin_anonymize_customer(NULL) $$,
    '22023',
    'Customer user ID is required',
    'Null user_id raises ADM-007'
);

-- Test 5: Non-existent customer is rejected (ORD-009)
SELECT throws_ok(
    $$ SELECT public.admin_anonymize_customer('ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) $$,
    'P0002',
    'Customer profile not found',
    'Non-existent customer raises ORD-009'
);

-- Test 6: Anonymizing an admin account is prohibited (ADM-001)
SELECT throws_ok(
    format('SELECT public.admin_anonymize_customer(%L::uuid)', tests.get_supabase_uid('admin_anon_user')),
    '42501',
    'Cannot anonymize an administrator account',
    'Admin account cannot be anonymized'
);

-- ============================================================================
-- 3. Execution of customer anonymization
-- ============================================================================

-- Test 7: admin_anonymize_customer succeeds for valid customer
SELECT lives_ok(
    format('SELECT public.admin_anonymize_customer(%L::uuid)', tests.get_supabase_uid('target_customer_user')),
    'admin_anonymize_customer executes cleanly for valid customer'
);

-- ============================================================================
-- 4. Verification of profile anonymization
-- ============================================================================

-- Test 8: Profile full_name is replaced with placeholder
SELECT is(
    (SELECT full_name FROM public.profiles WHERE id = tests.get_supabase_uid('target_customer_user')),
    'عميل مجهول',
    'Customer full_name is replaced with anonymous placeholder'
);

-- Test 9: Profile phone is null
SELECT is(
    (SELECT phone FROM public.profiles WHERE id = tests.get_supabase_uid('target_customer_user')),
    NULL,
    'Customer phone is nullified'
);

-- Test 10: Profile address columns are null
SELECT is(
    (SELECT city || district || address || floor || apartment || landmark
       FROM public.profiles
      WHERE id = tests.get_supabase_uid('target_customer_user')),
    NULL,
    'Customer profile address fields are nullified'
);

-- Test 11: Profile governorate_id is null
SELECT is(
    (SELECT governorate_id FROM public.profiles WHERE id = tests.get_supabase_uid('target_customer_user')),
    NULL,
    'Customer governorate_id is nullified'
);

-- ============================================================================
-- 5. Verification of order anonymization while retaining totals
-- ============================================================================

-- Test 12: Order ship_name is replaced with placeholder
SELECT is(
    (SELECT ship_name FROM public.orders WHERE id = :test_order_id),
    'عميل مجهول',
    'Order ship_name is replaced with anonymous placeholder'
);

-- Test 13: Order ship_phone is replaced with zeroes
SELECT is(
    (SELECT ship_phone FROM public.orders WHERE id = :test_order_id),
    '00000000000',
    'Order ship_phone is replaced with zeroes placeholder'
);

-- Test 14: Order ship_address is replaced with placeholder
SELECT is(
    (SELECT ship_address FROM public.orders WHERE id = :test_order_id),
    '[محذوف]',
    'Order ship_address is replaced with [محذوف] placeholder'
);

-- Test 15: Order optional address fields are nullified
SELECT is(
    (SELECT ship_city || ship_district || ship_floor || ship_apartment || ship_landmark || coalesce(notes, '')
       FROM public.orders
      WHERE id = :test_order_id),
    NULL,
    'Order optional address and notes fields are nullified'
);

-- Test 16: Order financial totals remain intact
SELECT is(
    (SELECT subtotal FROM public.orders WHERE id = :test_order_id),
    250.00,
    'Order subtotal is retained exactly'
);

-- Test 17: Order shipping fee remains intact
SELECT is(
    (SELECT shipping_fee FROM public.orders WHERE id = :test_order_id),
    35.00,
    'Order shipping fee is retained exactly'
);

-- Test 18: Order total matches subtotal + shipping_fee
SELECT is(
    (SELECT total FROM public.orders WHERE id = :test_order_id),
    285.00,
    'Order total is retained exactly'
);

-- Test 19: Order governorate remains intact for aggregate reporting
SELECT is(
    (SELECT ship_governorate FROM public.orders WHERE id = :test_order_id),
    'Cairo',
    'Order governorate is retained for regional analytics'
);

-- Test 20: Order items are preserved
SELECT is(
    (SELECT count(*)::integer FROM public.order_items WHERE order_id = :test_order_id),
    1,
    'Order items rows are preserved'
);

-- ============================================================================
-- 6. Verification of favorites and audit logging
-- ============================================================================

-- Test 21: Favorites are deleted
SELECT is(
    (SELECT count(*)::integer FROM public.favorites WHERE user_id = tests.get_supabase_uid('target_customer_user')),
    0,
    'Customer favorites are deleted upon anonymization'
);

-- Test 22: Audit log records CUSTOMER_ANONYMIZE action
SELECT ok(
    EXISTS (
        SELECT 1 FROM public.audit_log
         WHERE action = 'CUSTOMER_ANONYMIZE'
           AND entity = 'profiles'
           AND entity_id = tests.get_supabase_uid('target_customer_user')::text
           AND actor = tests.get_supabase_uid('admin_anon_user')
    ),
    'Audit log contains CUSTOMER_ANONYMIZE event with admin actor'
);

SELECT * FROM finish();
ROLLBACK;

BEGIN;

SELECT plan(32);

-- ============================================================================
-- Scenario S1: Sign-up creates a profile; a role sent in sign-up metadata is ignored
-- ============================================================================

-- Create a user with role: 'admin' injected into raw_user_meta_data
SELECT tests.create_supabase_user(
    'malicious_signup',
    'eve@example.com',
    '01012345678',
    '{"full_name": "Eve Attacker", "role": "admin"}'::jsonb
);

-- Profile row must be created automatically
SELECT ok(
    EXISTS(SELECT 1 FROM public.profiles WHERE id = tests.get_supabase_uid('malicious_signup')),
    'S1: Profile row created automatically on auth sign-up'
);

-- Full name should be extracted from metadata
SELECT is(
    (SELECT full_name FROM public.profiles WHERE id = tests.get_supabase_uid('malicious_signup')),
    'Eve Attacker',
    'S1: Profile full_name matches sign-up metadata'
);

-- Role in sign-up metadata MUST be ignored; profile role must default to customer
SELECT is(
    (SELECT role::text FROM public.profiles WHERE id = tests.get_supabase_uid('malicious_signup')),
    'customer',
    'S1: Injected role is ignored; profile role defaults to customer'
);

-- ============================================================================
-- Scenario S2: Visitors read active products only; cannot read orders or profiles, nor call place_order
-- ============================================================================

-- Insert one inactive product for testing catalogue visibility
INSERT INTO public.products (
    category_id,
    name,
    name_ar,
    price,
    stock_quantity,
    is_active
) VALUES (
    (SELECT id FROM public.categories LIMIT 1),
    'Hidden Inactive Product',
    'منتج غير نشط',
    150.00,
    10,
    false
);

-- Switch to anonymous visitor
SELECT tests.clear_authentication();

-- Visitor can read active products
SELECT ok(
    (SELECT count(*) FROM public.products) > 0,
    'S2: Visitor can read public active products'
);

-- Visitor cannot see inactive products
SELECT is(
    (SELECT count(*)::integer FROM public.products WHERE is_active = false),
    0,
    'S2: Visitor cannot see inactive products'
);

-- Visitor cannot select from orders (permission denied)
SELECT throws_ok(
    'SELECT * FROM public.orders',
    '42501',
    NULL,
    'S2: Visitor cannot read orders (permission denied)'
);

-- Visitor cannot select from profiles (permission denied)
SELECT throws_ok(
    'SELECT * FROM public.profiles',
    '42501',
    NULL,
    'S2: Visitor cannot read profiles (permission denied)'
);

-- Visitor cannot execute place_order (permission denied)
SELECT throws_ok(
    $$SELECT public.place_order(
    '[]'::jsonb,
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Eve', 'phone', '01011111111', 'governorate_id', 1::smallint, 'city', 'Cairo', 'address', 'Street 1', 'notes', NULL)
)$$,
    '42501',
    NULL,
    'S2: Visitor cannot execute place_order (permission denied)'
);

-- ============================================================================
-- Scenario S3: A customer edits their own profile but cannot change role
-- ============================================================================

-- Back to superuser context for setup
SELECT tests.authenticate_as_service_role();

SELECT tests.create_supabase_user(
    'customer_s3_alice',
    'alice@example.com',
    '01011112222',
    '{"full_name": "Alice Customer"}'::jsonb
);

SELECT tests.create_supabase_user(
    'customer_s3_bob',
    'bob@example.com',
    '01033334444',
    '{"full_name": "Bob Customer"}'::jsonb
);

-- Authenticate as Alice
SELECT tests.authenticate_as('customer_s3_alice');

-- Alice can update her own profile (full_name and city)
UPDATE public.profiles
   SET full_name = 'Alice Updated', city = 'Alexandria'
 WHERE id = tests.get_supabase_uid('customer_s3_alice');

SELECT is(
    (SELECT full_name FROM public.profiles WHERE id = tests.get_supabase_uid('customer_s3_alice')),
    'Alice Updated',
    'S3: Customer can update own profile full_name'
);

SELECT is(
    (SELECT city FROM public.profiles WHERE id = tests.get_supabase_uid('customer_s3_alice')),
    'Alexandria',
    'S3: Customer can update own profile city'
);

-- Alice cannot update Bob's profile (0 rows affected by RLS)
SELECT is_empty(
    $$UPDATE public.profiles SET full_name = 'Hacked Bob' WHERE id = tests.get_supabase_uid('customer_s3_bob') RETURNING id$$,
    'S3: Customer cannot update another customer profile (0 rows updated)'
);

-- Alice cannot update the role column (permission denied on column)
SELECT throws_ok(
    $$UPDATE public.profiles SET role = 'admin' WHERE id = tests.get_supabase_uid('customer_s3_alice')$$,
    '42501',
    NULL,
    'S3: Customer cannot update own role column (permission denied)'
);

-- Alice's role remains customer
SELECT is(
    (SELECT role::text FROM public.profiles WHERE id = tests.get_supabase_uid('customer_s3_alice')),
    'customer',
    'S3: Customer role remains customer'
);

-- ============================================================================
-- Scenario S8: Customers cannot insert or update orders or products directly
-- ============================================================================

-- Still authenticated as Alice (customer)

-- Alice cannot directly insert into orders (permission denied)
SELECT throws_ok(
    $$INSERT INTO public.orders (user_id, delivery_method, subtotal, shipping_fee, total, ship_name, ship_phone, ship_governorate, ship_address)
      VALUES (tests.get_supabase_uid('customer_s3_alice'), 'representative', 100, 30, 130, 'Alice', '01011112222', 'Cairo', 'Street 1')$$,
    '42501',
    NULL,
    'S8: Customer cannot directly insert into orders (permission denied)'
);

-- Alice cannot update orders directly (0 rows affected by RLS policy)
SELECT is_empty(
    $$UPDATE public.orders SET status = 'delivered' WHERE user_id = tests.get_supabase_uid('customer_s3_alice') RETURNING id$$,
    'S8: Customer cannot update orders directly (0 rows updated)'
);

-- Alice cannot directly insert into products (RLS check violation)
SELECT throws_ok(
    $$INSERT INTO public.products (category_id, name, price)
      VALUES ((SELECT id FROM public.categories LIMIT 1), 'Counterfeit Item', 25.00)$$,
    '42501',
    NULL,
    'S8: Customer cannot insert into products directly (RLS check violation)'
);

-- Alice cannot update products directly (0 rows affected by RLS policy)
SELECT is_empty(
    $$UPDATE public.products SET price = 1.00 WHERE id = (SELECT id FROM public.products LIMIT 1) RETURNING id$$,
    'S8: Customer cannot update products directly (0 rows updated)'
);

-- ============================================================================
-- Scenario S9: Customers see only their own orders, items and statistics; the admin sees all
-- ============================================================================

-- Provision the admin through owner SQL, never the service-role API.
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

SELECT tests.create_supabase_user(
    'user_alpha',
    'alpha@example.com',
    '01055556666',
    '{"full_name": "Alpha Customer"}'::jsonb
);

SELECT tests.create_supabase_user(
    'user_beta',
    'beta@example.com',
    '01077778888',
    '{"full_name": "Beta Customer"}'::jsonb
);

SELECT tests.create_supabase_user(
    'user_admin',
    'admin@example.com',
    '01099990000',
    '{"full_name": "Admin User"}'::jsonb
);

-- Promote user_admin to admin role directly in profiles
UPDATE public.profiles
   SET role = 'admin'
 WHERE id = tests.get_supabase_uid('user_admin');

-- Insert an order and order item for Alpha
INSERT INTO public.orders (
    user_id, delivery_method, subtotal, shipping_fee, total,
    ship_name, ship_phone, ship_governorate, ship_address, ship_postal_code, status
) VALUES (
    tests.get_supabase_uid('user_alpha'), 'representative', 200.00, 30.00, 230.00,
    'Alpha', '01055556666', 'Cairo', 'Alpha Street', '11511', 'pending'
);

INSERT INTO public.order_items (
    order_id, product_id, product_name, quantity, unit_price
) VALUES (
    (SELECT id FROM public.orders WHERE user_id = tests.get_supabase_uid('user_alpha') LIMIT 1),
    (SELECT id FROM public.products LIMIT 1),
    'Alpha Order Item',
    2,
    100.00
);

-- Insert an order and order item for Beta
INSERT INTO public.orders (
    user_id, delivery_method, subtotal, shipping_fee, total,
    ship_name, ship_phone, ship_governorate, ship_address, ship_postal_code, status
) VALUES (
    tests.get_supabase_uid('user_beta'), 'representative', 300.00, 30.00, 330.00,
    'Beta', '01077778888', 'Giza', 'Beta Street', '11511', 'pending'
);

INSERT INTO public.order_items (
    order_id, product_id, product_name, quantity, unit_price
) VALUES (
    (SELECT id FROM public.orders WHERE user_id = tests.get_supabase_uid('user_beta') LIMIT 1),
    (SELECT id FROM public.products LIMIT 1),
    'Beta Order Item',
    3,
    100.00
);

-- Authenticate as Alpha
SELECT tests.authenticate_as('user_alpha');

SELECT is(
    (SELECT count(*)::integer FROM public.orders),
    1,
    'S9: Customer Alpha sees only their own order'
);

SELECT is(
    (SELECT count(*)::integer FROM public.order_items),
    1,
    'S9: Customer Alpha sees only items for their own order'
);

SELECT is(
    (SELECT count(*)::integer FROM public.customer_stats),
    1,
    'S9: Customer Alpha sees only their own customer_stats row'
);

-- Authenticate as Beta
SELECT tests.authenticate_as('user_beta');

SELECT is(
    (SELECT count(*)::integer FROM public.orders),
    1,
    'S9: Customer Beta sees only their own order'
);

SELECT is(
    (SELECT count(*)::integer FROM public.order_items),
    1,
    'S9: Customer Beta sees only items for their own order'
);

SELECT is(
    (SELECT count(*)::integer FROM public.customer_stats),
    1,
    'S9: Customer Beta sees only their own customer_stats row'
);

-- Authenticate as Admin
SELECT tests.authenticate_as('user_admin');

SELECT ok(
    (SELECT count(*)::integer FROM public.orders) >= 2,
    'S9: Admin sees all orders (Alpha and Beta)'
);

SELECT ok(
    (SELECT count(*)::integer FROM public.order_items) >= 2,
    'S9: Admin sees all order items (Alpha and Beta)'
);

SELECT ok(
    (SELECT count(*)::integer FROM public.customer_stats) >= 3,
    'S9: Admin sees all customer_stats rows'
);

-- ============================================================================
-- Scenario S15: Favorites are private to each user
-- ============================================================================

-- Authenticate as Alpha
SELECT tests.authenticate_as('user_alpha');

-- Alpha adds a product to favorites
INSERT INTO public.favorites (user_id, product_id)
VALUES (
    tests.get_supabase_uid('user_alpha'),
    (SELECT id FROM public.products LIMIT 1)
);

SELECT is(
    (SELECT count(*)::integer FROM public.favorites),
    1,
    'S15: Alpha can insert and see their own favorite'
);

-- Alpha cannot insert a favorite for Beta (RLS check violation)
SELECT throws_ok(
    $$INSERT INTO public.favorites (user_id, product_id)
      VALUES (tests.get_supabase_uid('user_beta'), (SELECT id FROM public.products LIMIT 1))$$,
    '42501',
    NULL,
    'S15: Alpha cannot add favorite on behalf of Beta (RLS violation)'
);

-- Authenticate as Beta
SELECT tests.authenticate_as('user_beta');

-- Beta cannot see Alpha's favorite
SELECT is(
    (SELECT count(*)::integer FROM public.favorites),
    0,
    'S15: Beta sees zero favorites (Alpha favorite is hidden)'
);

-- Beta adds a favorite for self
INSERT INTO public.favorites (user_id, product_id)
VALUES (
    tests.get_supabase_uid('user_beta'),
    (SELECT id FROM public.products LIMIT 1)
);

SELECT is(
    (SELECT count(*)::integer FROM public.favorites),
    1,
    'S15: Beta can insert and see their own favorite'
);

-- Switch back to Alpha
SELECT tests.authenticate_as('user_alpha');

-- Alpha cannot delete Beta's favorite (0 rows affected by RLS)
SELECT is_empty(
    $$DELETE FROM public.favorites WHERE user_id = tests.get_supabase_uid('user_beta') RETURNING user_id$$,
    'S15: Alpha cannot delete Beta favorite (0 rows affected)'
);

-- Alpha's favorite is intact
SELECT is(
    (SELECT count(*)::integer FROM public.favorites),
    1,
    'S15: Alpha still has exactly 1 favorite'
);

SELECT * FROM finish();
ROLLBACK;

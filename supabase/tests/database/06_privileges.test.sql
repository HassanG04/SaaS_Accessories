BEGIN;

SELECT plan(38);

-- ============================================================================
-- Scenario S16: Anonymous role has read-only access to public tables and nothing else
-- ============================================================================

-- Ensure delivery fee exists for testing
INSERT INTO public.delivery_fees (governorate_id, method, fee)
VALUES (1, 'representative', 35.00)
ON CONFLICT (governorate_id, method) DO NOTHING;

-- Switch to anonymous visitor
SELECT tests.clear_authentication();

-- ----------------------------------------------------------------------------
-- Part 1: Permitted SELECT on public catalogue tables
-- ----------------------------------------------------------------------------

SELECT ok(
    (SELECT count(*) FROM public.categories) > 0,
    'S16: Anon can select from public.categories'
);

SELECT ok(
    (SELECT count(*) FROM public.products) > 0,
    'S16: Anon can select from public.products'
);

SELECT ok(
    (SELECT count(*) FROM public.governorates) > 0,
    'S16: Anon can select from public.governorates'
);

SELECT ok(
    (SELECT count(*) FROM public.delivery_fees) > 0,
    'S16: Anon can select from public.delivery_fees'
);

-- ----------------------------------------------------------------------------
-- Part 2: Prohibited writes on public catalogue tables (all throw 42501)
-- ----------------------------------------------------------------------------

-- categories: insert, update, delete
SELECT throws_ok(
    $$INSERT INTO public.categories (name, slug) VALUES ('Hacked', 'hacked')$$,
    '42501',
    NULL,
    'S16: Anon cannot insert into public.categories (permission denied)'
);

SELECT throws_ok(
    $$UPDATE public.categories SET name = 'Hacked' WHERE id = 1$$,
    '42501',
    NULL,
    'S16: Anon cannot update public.categories (permission denied)'
);

SELECT throws_ok(
    $$DELETE FROM public.categories WHERE id = 1$$,
    '42501',
    NULL,
    'S16: Anon cannot delete from public.categories (permission denied)'
);

-- products: insert, update, delete
SELECT throws_ok(
    $$INSERT INTO public.products (category_id, name, price) VALUES (1, 'Hacked', 10.00)$$,
    '42501',
    NULL,
    'S16: Anon cannot insert into public.products (permission denied)'
);

SELECT throws_ok(
    $$UPDATE public.products SET price = 1.00 WHERE id = 1$$,
    '42501',
    NULL,
    'S16: Anon cannot update public.products (permission denied)'
);

SELECT throws_ok(
    $$DELETE FROM public.products WHERE id = 1$$,
    '42501',
    NULL,
    'S16: Anon cannot delete from public.products (permission denied)'
);

-- governorates: insert, update, delete
SELECT throws_ok(
    $$INSERT INTO public.governorates (id, name_en, name_ar) VALUES (99, 'Hacked', 'مقرصن')$$,
    '42501',
    NULL,
    'S16: Anon cannot insert into public.governorates (permission denied)'
);

SELECT throws_ok(
    $$UPDATE public.governorates SET name_en = 'Hacked' WHERE id = 1$$,
    '42501',
    NULL,
    'S16: Anon cannot update public.governorates (permission denied)'
);

SELECT throws_ok(
    $$DELETE FROM public.governorates WHERE id = 1$$,
    '42501',
    NULL,
    'S16: Anon cannot delete from public.governorates (permission denied)'
);

-- delivery_fees: insert, update, delete
SELECT throws_ok(
    $$INSERT INTO public.delivery_fees (governorate_id, method, fee) VALUES (1, 'egypt_post', 10.00)$$,
    '42501',
    NULL,
    'S16: Anon cannot insert into public.delivery_fees (permission denied)'
);

SELECT throws_ok(
    $$UPDATE public.delivery_fees SET fee = 0.00 WHERE governorate_id = 1$$,
    '42501',
    NULL,
    'S16: Anon cannot update public.delivery_fees (permission denied)'
);

SELECT throws_ok(
    $$DELETE FROM public.delivery_fees WHERE governorate_id = 1$$,
    '42501',
    NULL,
    'S16: Anon cannot delete from public.delivery_fees (permission denied)'
);

-- ----------------------------------------------------------------------------
-- Part 3: Prohibited access on private tables and views (all throw 42501)
-- ----------------------------------------------------------------------------

-- profiles: select, insert, update, delete
SELECT throws_ok(
    'SELECT * FROM public.profiles',
    '42501',
    NULL,
    'S16: Anon cannot select from public.profiles (permission denied)'
);

SELECT throws_ok(
    $$INSERT INTO public.profiles (id, full_name) VALUES (extensions.uuid_generate_v4(), 'Hacker')$$,
    '42501',
    NULL,
    'S16: Anon cannot insert into public.profiles (permission denied)'
);

SELECT throws_ok(
    $$UPDATE public.profiles SET full_name = 'Hacker'$$,
    '42501',
    NULL,
    'S16: Anon cannot update public.profiles (permission denied)'
);

SELECT throws_ok(
    'DELETE FROM public.profiles',
    '42501',
    NULL,
    'S16: Anon cannot delete from public.profiles (permission denied)'
);

-- orders: select, insert, update, delete
SELECT throws_ok(
    'SELECT * FROM public.orders',
    '42501',
    NULL,
    'S16: Anon cannot select from public.orders (permission denied)'
);

SELECT throws_ok(
    $$INSERT INTO public.orders (user_id, delivery_method, subtotal, shipping_fee, total, ship_name, ship_phone, ship_governorate, ship_address)
      VALUES (extensions.uuid_generate_v4(), 'representative', 10, 35, 45, 'Hacker', '010', 'Cairo', 'Addr')$$,
    '42501',
    NULL,
    'S16: Anon cannot insert into public.orders (permission denied)'
);

SELECT throws_ok(
    $$UPDATE public.orders SET status = 'delivered'$$,
    '42501',
    NULL,
    'S16: Anon cannot update public.orders (permission denied)'
);

SELECT throws_ok(
    'DELETE FROM public.orders',
    '42501',
    NULL,
    'S16: Anon cannot delete from public.orders (permission denied)'
);

-- order_items: select, insert, update, delete
SELECT throws_ok(
    'SELECT * FROM public.order_items',
    '42501',
    NULL,
    'S16: Anon cannot select from public.order_items (permission denied)'
);

SELECT throws_ok(
    $$INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price)
      VALUES (1, 1, 'Item', 1, 10.00)$$,
    '42501',
    NULL,
    'S16: Anon cannot insert into public.order_items (permission denied)'
);

SELECT throws_ok(
    $$UPDATE public.order_items SET quantity = 99$$,
    '42501',
    NULL,
    'S16: Anon cannot update public.order_items (permission denied)'
);

SELECT throws_ok(
    'DELETE FROM public.order_items',
    '42501',
    NULL,
    'S16: Anon cannot delete from public.order_items (permission denied)'
);

-- favorites: select, insert, update, delete
SELECT throws_ok(
    'SELECT * FROM public.favorites',
    '42501',
    NULL,
    'S16: Anon cannot select from public.favorites (permission denied)'
);

SELECT throws_ok(
    $$INSERT INTO public.favorites (user_id, product_id) VALUES (extensions.uuid_generate_v4(), 1)$$,
    '42501',
    NULL,
    'S16: Anon cannot insert into public.favorites (permission denied)'
);

SELECT throws_ok(
    $$UPDATE public.favorites SET product_id = 2$$,
    '42501',
    NULL,
    'S16: Anon cannot update public.favorites (permission denied)'
);

SELECT throws_ok(
    'DELETE FROM public.favorites',
    '42501',
    NULL,
    'S16: Anon cannot delete from public.favorites (permission denied)'
);

-- customer_stats view: select
SELECT throws_ok(
    'SELECT * FROM public.customer_stats',
    '42501',
    NULL,
    'S16: Anon cannot select from public.customer_stats (permission denied)'
);

-- ----------------------------------------------------------------------------
-- Part 4: Function access
-- ----------------------------------------------------------------------------

SELECT throws_ok(
    $$SELECT public.place_order(
    '[]'::jsonb,
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Hacker', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'Cairo', 'address', 'Addr', 'notes', NULL)
)$$,
    '42501',
    NULL,
    'S16: Anon cannot execute place_order (permission denied)'
);

SELECT throws_ok(
    'SELECT public.cancel_my_order(1)',
    '42501',
    NULL,
    'S16: Anon cannot execute cancel_my_order (permission denied)'
);

SELECT throws_ok(
    format('SELECT public.admin_set_role(''%s''::uuid, ''admin''::public.user_role)', extensions.uuid_generate_v4()),
    '42883',
    NULL,
    'S16/S20: Anon cannot execute the removed admin_set_role function'
);

SELECT throws_ok(
    'SELECT public.admin_dashboard()',
    '42501',
    NULL,
    'S16: Anon cannot execute admin_dashboard (permission denied)'
);

-- is_admin is callable by anon and safely returns false
SELECT is(
    public.is_admin(),
    false,
    'S16: Anon calling is_admin() safely returns false'
);

SELECT * FROM finish();
ROLLBACK;

BEGIN;

SELECT plan(43);

-- ============================================================================
-- Setup for order tests
-- ============================================================================

-- Ensure delivery fee exists for governorate 1
INSERT INTO public.delivery_fees (governorate_id, method, fee)
VALUES (1, 'representative', 35.00)
ON CONFLICT (governorate_id, method) DO NOTHING;

-- Create customer user
SELECT tests.create_supabase_user(
    'buyer_s4',
    'buyer_s4@example.com',
    '01012345678',
    '{"full_name": "S4 Buyer"}'::jsonb
);

-- Retrieve product IDs from demo seed
-- Product 1: 'Pearl drop earrings', price 250, discount 50 -> final_price = 125.00, stock = 12
-- Product 2: 'Gold hoop earrings', price 400, discount 0 -> final_price = 400.00, stock = 5
-- Product 4: 'Layered silver chain', price 520, discount 0, stock = 0 (out of stock)

-- Create an inactive product for S5 testing
INSERT INTO public.products (
    category_id, name, name_ar, price, stock_quantity, is_active
) VALUES (
    (SELECT id FROM public.categories LIMIT 1),
    'Inactive Bracelet',
    'سوار غير نشط',
    100.00,
    10,
    false
) RETURNING id AS inactive_product_id \gset

-- Authenticate as customer
SELECT tests.authenticate_as('buyer_s4');

-- ============================================================================
-- Scenario S4: place_order uses database prices, adds fee, updates stock & sold
-- ============================================================================

-- Place valid order for 2 units of Product 1
SELECT public.place_order(
    jsonb_build_array(
        jsonb_build_object(
            'product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'),
            'quantity', 2
        )
    ),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Hassan Buyer', 'phone', '01012345678', 'governorate_id', 1::smallint, 'city', 'Cairo', 'address', '10 Abbas El Akkad St', 'notes', NULL)
) AS s4_order_id \gset

SELECT ok(
    :'s4_order_id' IS NOT NULL AND :'s4_order_id' > 0,
    'S4: Order successfully placed and returned valid ID'
);

SELECT is(
    (SELECT status::text FROM public.orders WHERE id = :'s4_order_id'),
    'pending',
    'S4: Order status defaults to pending'
);

-- Subtotal: 2 * 125.00 = 250.00
SELECT is(
    (SELECT subtotal FROM public.orders WHERE id = :'s4_order_id'),
    250.00,
    'S4: Order subtotal computed from database final_price (2 * 125.00 = 250.00)'
);

SELECT is(
    (SELECT shipping_fee FROM public.orders WHERE id = :'s4_order_id'),
    35.00,
    'S4: Order shipping_fee matched governorate delivery fee (35.00)'
);

SELECT is(
    (SELECT total FROM public.orders WHERE id = :'s4_order_id'),
    285.00,
    'S4: Order total correctly equals subtotal + shipping_fee (285.00)'
);

SELECT is(
    (SELECT count(*)::integer FROM public.order_items WHERE order_id = :'s4_order_id'),
    1,
    'S4: Exactly 1 order item row created'
);

SELECT is(
    (SELECT quantity FROM public.order_items WHERE order_id = :'s4_order_id'),
    2,
    'S4: Order item quantity recorded as 2'
);

SELECT is(
    (SELECT unit_price FROM public.order_items WHERE order_id = :'s4_order_id'),
    125.00,
    'S4: Order item unit_price matches database final_price'
);

SELECT is(
    (SELECT stock_quantity FROM public.products WHERE name = 'Pearl drop earrings'),
    10,
    'S4: Product stock_quantity decremented by 2 (12 -> 10)'
);

SELECT is(
    (SELECT sold_count FROM public.products WHERE name = 'Pearl drop earrings'),
    2,
    'S4: Product sold_count incremented by 2 (0 -> 2)'
);

-- ============================================================================
-- Scenario S5: Rejected with nothing written: oversell, out of stock, unknown
-- product, empty or invalid cart, zero or negative qty, missing address, unavailable method
-- ============================================================================

-- Baseline order count and stock before rejection tests
SELECT count(*)::integer FROM public.orders \gset baseline_
SELECT stock_quantity FROM public.products WHERE name = 'Pearl drop earrings' \gset p1_
SELECT stock_quantity FROM public.products WHERE name = 'Layered silver chain' \gset p4_

-- 1. Oversell: request 20 units when only 10 left
SELECT throws_ok(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'), 'quantity', 20)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    '22023',
    NULL,
    'S5.1: Oversell rejected with insufficient stock error'
);

SELECT is(
    (SELECT count(*)::integer FROM public.orders),
    :baseline_count,
    'S5.1: Oversell left no order row written'
);

SELECT is(
    (SELECT stock_quantity FROM public.products WHERE name = 'Pearl drop earrings'),
    :p1_stock_quantity,
    'S5.1: Oversell left product stock untouched'
);

-- 2. Out of stock: product 4 has stock = 0
SELECT throws_ok(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Layered silver chain'), 'quantity', 1)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    '22023',
    NULL,
    'S5.2: Out of stock product rejected'
);

SELECT is(
    (SELECT count(*)::integer FROM public.orders),
    :baseline_count,
    'S5.2: Out of stock rejection left no order row written'
);

SELECT is(
    (SELECT stock_quantity FROM public.products WHERE name = 'Layered silver chain'),
    :p4_stock_quantity,
    'S5.2: Out of stock rejection left stock untouched'
);

-- 3. Inactive product rejected
SELECT throws_ok(
    format(
        'SELECT public.place_order(
    jsonb_build_array(jsonb_build_object(''product_id'', %s, ''quantity'', 1)),
    ''representative'', ''cod'',
    jsonb_build_object(''postal_code'', ''11511'', ''name'', ''Buyer'', ''phone'', ''010'', ''governorate_id'', 1::smallint, ''city'', ''City'', ''address'', ''Addr'', ''notes'', NULL)
)',
        :'inactive_product_id'
    ),
    '22023',
    NULL,
    'S5.3: Inactive product rejected'
);

SELECT is(
    (SELECT count(*)::integer FROM public.orders),
    :baseline_count,
    'S5.3: Inactive product rejection left no order row written'
);

-- 4. Unknown product ID (999999)
SELECT throws_ok(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', 999999, 'quantity', 1)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    '22023',
    NULL,
    'S5.4: Nonexistent product ID rejected'
);

SELECT is(
    (SELECT count(*)::integer FROM public.orders),
    :baseline_count,
    'S5.4: Unknown product rejection left no order row written'
);

-- 5. Empty cart
SELECT throws_ok(
    $$SELECT public.place_order(
    '[]'::jsonb,
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    '22023',
    NULL,
    'S5.5: Empty cart rejected'
);

SELECT is(
    (SELECT count(*)::integer FROM public.orders),
    :baseline_count,
    'S5.5: Empty cart rejection left no order row written'
);

-- 6. Invalid cart line (missing quantity)
SELECT throws_ok(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'))),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    '22023',
    NULL,
    'S5.6: Cart line missing quantity rejected'
);

SELECT is(
    (SELECT count(*)::integer FROM public.orders),
    :baseline_count,
    'S5.6: Invalid cart rejection left no order row written'
);

-- 7. Zero quantity
SELECT throws_ok(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'), 'quantity', 0)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    '22023',
    NULL,
    'S5.7: Zero quantity rejected'
);

SELECT is(
    (SELECT count(*)::integer FROM public.orders),
    :baseline_count,
    'S5.7: Zero quantity rejection left no order row written'
);

-- 8. Negative quantity
SELECT throws_ok(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'), 'quantity', -3)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    '22023',
    NULL,
    'S5.8: Negative quantity rejected'
);

SELECT is(
    (SELECT count(*)::integer FROM public.orders),
    :baseline_count,
    'S5.8: Negative quantity rejection left no order row written'
);

-- 9. Missing recipient name
SELECT throws_ok(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'), 'quantity', 1)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', '   ', 'phone', '01012345678', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    '22023',
    NULL,
    'S5.9: Blank recipient name rejected'
);

SELECT is(
    (SELECT count(*)::integer FROM public.orders),
    :baseline_count,
    'S5.9: Blank name rejection left no order row written'
);

-- 10. Missing recipient phone
SELECT throws_ok(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'), 'quantity', 1)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Valid Name', 'phone', '', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    '22023',
    NULL,
    'S5.10: Empty recipient phone rejected'
);

SELECT is(
    (SELECT count(*)::integer FROM public.orders),
    :baseline_count,
    'S5.10: Empty phone rejection left no order row written'
);

-- 11. Missing recipient address
SELECT throws_ok(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'), 'quantity', 1)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Valid Name', 'phone', '01012345678', 'governorate_id', 1::smallint, 'city', 'City', 'address', '   ', 'notes', NULL)
)$$,
    '22023',
    NULL,
    'S5.11: Blank recipient address rejected'
);

SELECT is(
    (SELECT count(*)::integer FROM public.orders),
    :baseline_count,
    'S5.11: Blank address rejection left no order row written'
);

-- 12. Unavailable delivery method
SELECT throws_ok(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'), 'quantity', 1)),
    'egypt_post', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Valid Name', 'phone', '01012345678', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Address', 'notes', NULL)
)$$,
    '22023',
    NULL,
    'S5.12: Unconfigured delivery method rejected'
);

SELECT is(
    (SELECT count(*)::integer FROM public.orders),
    :baseline_count,
    'S5.12: Unavailable method rejection left no order row written'
);

-- ============================================================================
-- Scenario S6: Duplicate cart lines for one product are merged
-- ============================================================================

-- Product 2: 'Gold hoop earrings', price 400.00, discount 0, final_price 400.00, stock 5, sold 0
SELECT public.place_order(
    jsonb_build_array(
        jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Gold hoop earrings'), 'quantity', 1),
        jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Gold hoop earrings'), 'quantity', 2)
    ),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Hassan Duplicate Line Buyer', 'phone', '01012345678', 'governorate_id', 1::smallint, 'city', 'Cairo', 'address', 'Nasr City', 'notes', NULL)
) AS s6_order_id \gset

SELECT ok(
    :'s6_order_id' IS NOT NULL AND :'s6_order_id' > 0,
    'S6: Order with duplicate cart lines placed successfully'
);

-- Subtotal: (1 + 2) * 400.00 = 1200.00
SELECT is(
    (SELECT subtotal FROM public.orders WHERE id = :'s6_order_id'),
    1200.00,
    'S6: Duplicate cart lines merged into subtotal (3 * 400.00 = 1200.00)'
);

SELECT is(
    (SELECT total FROM public.orders WHERE id = :'s6_order_id'),
    1235.00,
    'S6: Total matches subtotal + shipping_fee (1200 + 35 = 1235.00)'
);

SELECT is(
    (SELECT count(*)::integer FROM public.order_items WHERE order_id = :'s6_order_id'),
    1,
    'S6: Duplicate cart lines merged into exactly 1 order_items row'
);

SELECT is(
    (SELECT quantity FROM public.order_items WHERE order_id = :'s6_order_id'),
    3,
    'S6: Merged order item has summed quantity of 3'
);

SELECT is(
    (SELECT stock_quantity FROM public.products WHERE name = 'Gold hoop earrings'),
    2,
    'S6: Product stock decremented by merged quantity (5 - 3 = 2)'
);

SELECT is(
    (SELECT sold_count FROM public.products WHERE name = 'Gold hoop earrings'),
    3,
    'S6: Product sold_count incremented by merged quantity (0 + 3 = 3)'
);

SELECT * FROM finish();
ROLLBACK;

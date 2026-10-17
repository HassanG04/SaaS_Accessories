BEGIN;

SELECT plan(19);

-- ============================================================================
-- Setup for T-1.20 Abuse Controls (Scenarios S27, S28)
-- ============================================================================

SELECT tests.create_supabase_user(
    'admin_s27',
    'admin_s27@example.com',
    '01011110027',
    '{"full_name": "Admin S27"}'::jsonb
);

SELECT tests.create_supabase_user(
    'customer_s27',
    'customer_s27@example.com',
    '01022220027',
    '{"full_name": "Customer S27"}'::jsonb
);

-- Promote admin_s27 to admin as database owner
UPDATE public.profiles
   SET role = 'admin'
 WHERE id = tests.get_supabase_uid('admin_s27');

-- Ensure delivery fee exists for governorate 1
INSERT INTO public.delivery_fees (governorate_id, method, fee)
VALUES (1, 'representative', 35.00)
ON CONFLICT (governorate_id, method) DO NOTHING;

-- Create test product with high stock
INSERT INTO public.products (
    category_id, name, name_ar, price, stock_quantity, is_active
) VALUES (
    (SELECT id FROM public.categories LIMIT 1),
    'S27 Bulk Product',
    'منتج بالجملة',
    50.00,
    500,
    true
) RETURNING id AS s27_product_id \gset

-- ============================================================================
-- 1. Scenario S27: Quantity cap & Line cap
-- ============================================================================

SELECT tests.authenticate_as('customer_s27');

-- 1. Quantity 0 is rejected with ORD-006 (22023)
SELECT throws_ok(
    format($$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 0)),
    'representative',
    'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Ali', 'phone', '01011110027', 'governorate_id', 1, 'address', 'Addr')
)$$, :s27_product_id),
    '22023',
    'Quantity must be between 1 and 20',
    'S27: Quantity 0 rejected with ORD-006'
);

-- 2. Quantity 21 (> 20) is rejected with ORD-006 (22023)
SELECT throws_ok(
    format($$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 21)),
    'representative',
    'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Ali', 'phone', '01011110027', 'governorate_id', 1, 'address', 'Addr')
)$$, :s27_product_id),
    '22023',
    'Quantity must be between 1 and 20',
    'S27: Quantity > 20 rejected with ORD-006'
);

-- 3. More than 30 lines in cart rejected with ORD-013 (22023)
SELECT throws_ok(
    format($$SELECT public.place_order(
    (SELECT jsonb_agg(jsonb_build_object('product_id', %s, 'quantity', 1)) FROM generate_series(1, 31)),
    'representative',
    'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Ali', 'phone', '01011110027', 'governorate_id', 1, 'address', 'Addr')
)$$, :s27_product_id),
    '22023',
    'Too many items in order',
    'S27: More than 30 order lines rejected with ORD-013'
);

-- ============================================================================
-- 2. Scenario S27: Pending-order limit (default 3)
-- ============================================================================

-- 4. 1st pending order succeeds
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :s27_product_id, 'quantity', 1)),
    'representative',
    'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Ali', 'phone', '01011110027', 'governorate_id', 1, 'address', 'Addr 1')
) AS s27_order_1 \gset

SELECT is(
    (:s27_order_1 > 0),
    true,
    'S27: 1st pending order placed successfully'
);

-- 5. 2nd pending order succeeds
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :s27_product_id, 'quantity', 1)),
    'representative',
    'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Ali', 'phone', '01011110027', 'governorate_id', 1, 'address', 'Addr 2')
) AS s27_order_2 \gset

SELECT is(
    (:s27_order_2 > 0),
    true,
    'S27: 2nd pending order placed successfully'
);

-- 6. 3rd pending order succeeds
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :s27_product_id, 'quantity', 1)),
    'representative',
    'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Ali', 'phone', '01011110027', 'governorate_id', 1, 'address', 'Addr 3')
) AS s27_order_3 \gset

SELECT is(
    (:s27_order_3 > 0),
    true,
    'S27: 3rd pending order placed successfully'
);

-- 7. 4th pending order is rejected with ORD-010 (22023)
SELECT throws_ok(
    format($$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 1)),
    'representative',
    'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Ali', 'phone', '01011110027', 'governorate_id', 1, 'address', 'Addr 4')
)$$, :s27_product_id),
    '22023',
    'Pending orders limit reached',
    'S27: 4th pending order rejected with ORD-010'
);

-- 8. Customer cancels one of their pending orders
SELECT lives_ok(
    format($$SELECT public.cancel_my_order(%s)$$, :s27_order_1),
    'S27: Customer cancels pending order'
);

-- 9. Active pending orders count is now 2
SELECT is(
    (SELECT count(*)::integer FROM public.orders
      WHERE user_id = tests.get_supabase_uid('customer_s27') AND status = 'pending'),
    2,
    'S27: Customer has 2 pending orders after cancellation'
);

-- 10. Customer can now place another pending order
SELECT lives_ok(
    format($$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 1)),
    'representative',
    'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Ali', 'phone', '01011110027', 'governorate_id', 1, 'address', 'Addr 5')
)$$, :s27_product_id),
    'S27: Customer can place an order after freeing a pending slot'
);

-- 11. Admin raises pending_order_limit setting to 5
SELECT tests.authenticate_as('admin_s27', 'aal2');
SELECT public.admin_update_setting('pending_order_limit', '5'::jsonb);

SELECT is(
    (SELECT (value #>> '{}')::integer FROM public.shop_settings WHERE key = 'pending_order_limit'),
    5,
    'S27: Admin updated pending_order_limit to 5'
);

-- 12. Customer can now place a 4th pending order without ORD-010
SELECT tests.authenticate_as('customer_s27');
SELECT lives_ok(
    format($$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 1)),
    'representative',
    'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Ali', 'phone', '01011110027', 'governorate_id', 1, 'address', 'Addr 6')
)$$, :s27_product_id),
    'S27: Customer can place 4th pending order when limit is 5'
);

-- ============================================================================
-- 3. Scenario S28: Rate limits (check_rate_limit & SYS-003)
-- ============================================================================

-- 13. Call 1 of check_rate_limit succeeds
SELECT lives_ok(
    $$SELECT public.check_rate_limit('test_rate_action', 3, interval '1 minute')$$,
    'S28: Rate limit call 1 succeeds'
);

-- 14. Call 2 succeeds
SELECT lives_ok(
    $$SELECT public.check_rate_limit('test_rate_action', 3, interval '1 minute')$$,
    'S28: Rate limit call 2 succeeds'
);

-- 15. Call 3 succeeds
SELECT lives_ok(
    $$SELECT public.check_rate_limit('test_rate_action', 3, interval '1 minute')$$,
    'S28: Rate limit call 3 succeeds'
);

-- 16. Call 4 exceeds limit (3) and raises SYS-003 (22023)
SELECT throws_ok(
    $$SELECT public.check_rate_limit('test_rate_action', 3, interval '1 minute')$$,
    '22023',
    'Rate limit exceeded',
    'S28: 4th call exceeds limit and raises SYS-003'
);

-- 17. After window expires, count resets and call succeeds again
SELECT tests.authenticate_as_service_role();
UPDATE public.rate_limits
   SET window_start = now() - interval '2 minutes'
 WHERE key = tests.get_supabase_uid('customer_s27')::text || ':test_rate_action';
SELECT tests.authenticate_as('customer_s27');

SELECT lives_ok(
    $$SELECT public.check_rate_limit('test_rate_action', 3, interval '1 minute')$$,
    'S28: Call succeeds after window expiration'
);

-- ============================================================================
-- 4. Table permissions: rate_limits is internal (no API access)
-- ============================================================================

-- 18. Customer direct SELECT on rate_limits is blocked (42501)
SELECT throws_ok(
    $$SELECT * FROM public.rate_limits$$,
    '42501',
    NULL,
    'S28: Customer direct SELECT on rate_limits is denied'
);

-- 19. Anon direct SELECT on rate_limits is blocked (42501)
SELECT tests.clear_authentication();
SELECT throws_ok(
    $$SELECT * FROM public.rate_limits$$,
    '42501',
    NULL,
    'S28: Anon direct SELECT on rate_limits is denied'
);

SELECT * FROM finish();
ROLLBACK;

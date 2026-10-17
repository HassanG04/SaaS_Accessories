BEGIN;

SELECT plan(22);

-- ============================================================================
-- Setup for T-1.21 Stock Ledger (Scenario S29)
-- ============================================================================

SELECT tests.create_supabase_user(
    'admin_s29',
    'admin_s29@example.com',
    '01011110029',
    '{"full_name": "Admin S29"}'::jsonb
);

SELECT tests.create_supabase_user(
    'customer_s29',
    'customer_s29@example.com',
    '01022220029',
    '{"full_name": "Customer S29"}'::jsonb
);

-- Promote admin_s29 to admin as database owner
UPDATE public.profiles
   SET role = 'admin'
 WHERE id = tests.get_supabase_uid('admin_s29');

-- Ensure delivery fee exists for governorate 1
INSERT INTO public.delivery_fees (governorate_id, method, fee)
VALUES (1, 'representative', 35.00)
ON CONFLICT (governorate_id, method) DO NOTHING;

-- ============================================================================
-- 1. Seed data movements check
-- ============================================================================

-- 1. For every product with stock, sum(delta) in stock_movements matches products.stock_quantity
SELECT is(
    (SELECT count(*)::integer
       FROM public.products p
      WHERE p.stock_quantity <> (
        SELECT coalesce(sum(sm.delta), 0)
          FROM public.stock_movements sm
         WHERE sm.product_id = p.id
      )),
    0,
    'S29: Stock movements sum matches current stock for all existing products'
);

-- Create a new test product
INSERT INTO public.products (
    category_id, name, name_ar, price, stock_quantity, is_active
) VALUES (
    (SELECT id FROM public.categories LIMIT 1),
    'S29 Ledger Product',
    'منتج سجل المخزون',
    80.00,
    50,
    true
) RETURNING id AS s29_prod_id \gset

-- 2. New product insert creates initial movement with delta = 50 and reason restock
SELECT is(
    (SELECT (delta, new_quantity, reason)
       FROM public.stock_movements
      WHERE product_id = :s29_prod_id
      ORDER BY id ASC LIMIT 1),
    ROW(50, 50, 'restock'::public.stock_reason),
    'S29: Initial product stock logged as restock movement'
);

-- ============================================================================
-- 2. Order movement (reason = 'order')
-- ============================================================================

SELECT tests.authenticate_as('customer_s29');

SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :s29_prod_id, 'quantity', 3)),
    'representative',
    'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Omar', 'phone', '01022220029', 'governorate_id', 1, 'address', 'Nasr City')
) AS s29_order_id \gset

-- 3. Product stock decremented to 47
SELECT is(
    (SELECT stock_quantity FROM public.products WHERE id = :s29_prod_id),
    47,
    'S29: Product stock decremented to 47 after order'
);

-- Switch to admin (aal2) to inspect stock_movements ledger (which is admin-only)
SELECT tests.authenticate_as('admin_s29', 'aal2');

-- 4. Order movement delta is -3
SELECT is(
    (SELECT delta FROM public.stock_movements
      WHERE product_id = :s29_prod_id AND order_id = :s29_order_id),
    -3,
    'S29: Order movement delta is -3'
);

-- 5. Order movement reason is 'order'
SELECT is(
    (SELECT reason FROM public.stock_movements
      WHERE product_id = :s29_prod_id AND order_id = :s29_order_id),
    'order'::public.stock_reason,
    'S29: Order movement reason is order'
);

-- 6. Order movement actor is customer
SELECT is(
    (SELECT actor FROM public.stock_movements
      WHERE product_id = :s29_prod_id AND order_id = :s29_order_id),
    tests.get_supabase_uid('customer_s29'),
    'S29: Order movement actor is customer uid'
);

-- 7. Order movement order_id is recorded
SELECT is(
    (SELECT order_id FROM public.stock_movements
      WHERE product_id = :s29_prod_id AND order_id = :s29_order_id),
    :s29_order_id::bigint,
    'S29: Order movement references order id'
);

-- 8. Order movement new_quantity is 47
SELECT is(
    (SELECT new_quantity FROM public.stock_movements
      WHERE product_id = :s29_prod_id AND order_id = :s29_order_id),
    47,
    'S29: Order movement new_quantity is 47'
);

-- ============================================================================
-- 3. Cancel movement (reason = 'cancel')
-- ============================================================================

SELECT tests.authenticate_as('customer_s29');
SELECT public.cancel_my_order(:s29_order_id);

-- 9. Product stock restocked back to 50
SELECT is(
    (SELECT stock_quantity FROM public.products WHERE id = :s29_prod_id),
    50,
    'S29: Product stock restored to 50 on order cancellation'
);

-- Switch to admin (aal2) to inspect cancel movement in stock_movements
SELECT tests.authenticate_as('admin_s29', 'aal2');

-- 10. Cancel movement delta is +3
SELECT is(
    (SELECT delta FROM public.stock_movements
      WHERE product_id = :s29_prod_id AND reason = 'cancel'::public.stock_reason),
    3,
    'S29: Cancel movement delta is +3'
);

-- 11. Cancel movement reason is 'cancel'
SELECT is(
    (SELECT reason FROM public.stock_movements
      WHERE product_id = :s29_prod_id AND reason = 'cancel'::public.stock_reason),
    'cancel'::public.stock_reason,
    'S29: Cancel movement reason is cancel'
);

-- 12. Cancel movement references order_id
SELECT is(
    (SELECT order_id FROM public.stock_movements
      WHERE product_id = :s29_prod_id AND reason = 'cancel'::public.stock_reason),
    :s29_order_id::bigint,
    'S29: Cancel movement references cancelled order id'
);

-- ============================================================================
-- 4. Admin direct edit movement (reason = 'admin_adjust')
-- ============================================================================

SELECT tests.authenticate_as('admin_s29', 'aal2');
SELECT set_config('app.stock_reason', '', true);

UPDATE public.products
   SET stock_quantity = 60
 WHERE id = :s29_prod_id;

-- 13. Admin edit changes stock to 60
SELECT is(
    (SELECT stock_quantity FROM public.products WHERE id = :s29_prod_id),
    60,
    'S29: Product stock updated to 60 by admin'
);

-- 14. Admin edit movement delta is +10
SELECT is(
    (SELECT delta FROM public.stock_movements
      WHERE product_id = :s29_prod_id AND reason = 'admin_adjust'::public.stock_reason),
    10,
    'S29: Admin edit movement delta is 10'
);

-- 15. Admin edit movement reason is 'admin_adjust'
SELECT is(
    (SELECT reason FROM public.stock_movements
      WHERE product_id = :s29_prod_id AND reason = 'admin_adjust'::public.stock_reason),
    'admin_adjust'::public.stock_reason,
    'S29: Admin edit movement reason defaults to admin_adjust'
);

-- 16. Admin edit movement actor is admin
SELECT is(
    (SELECT actor FROM public.stock_movements
      WHERE product_id = :s29_prod_id AND reason = 'admin_adjust'::public.stock_reason),
    tests.get_supabase_uid('admin_s29'),
    'S29: Admin edit movement actor is admin uid'
);

-- 17. All movements for prod_s29 sum up to current stock (50 - 3 + 3 + 10 = 60)
SELECT is(
    (SELECT sum(delta)::integer FROM public.stock_movements WHERE product_id = :s29_prod_id),
    60,
    'S29: Sum of all stock movements equals current stock (60)'
);

-- ============================================================================
-- 5. Access control & Immutability
-- ============================================================================

-- 18. Customer direct SELECT sees 0 rows (RLS policy blocks non-admin)
SELECT tests.authenticate_as('customer_s29');
SELECT is(
    (SELECT count(*)::bigint FROM public.stock_movements),
    0::bigint,
    'S29: Customer cannot read stock_movements (0 rows returned by RLS)'
);

-- 19. Admin at aal1 sees 0 rows
SELECT tests.authenticate_as('admin_s29', 'aal1');
SELECT is(
    (SELECT count(*)::bigint FROM public.stock_movements),
    0::bigint,
    'S29: Admin at aal1 cannot read stock_movements'
);

-- 20. Admin at aal2 CAN read stock_movements
SELECT tests.authenticate_as('admin_s29', 'aal2');
SELECT cmp_ok(
    (SELECT count(*)::bigint FROM public.stock_movements),
    '>=',
    4::bigint,
    'S29: Admin at aal2 can read stock_movements'
);

-- 21. Direct UPDATE on stock_movements is blocked by immutability trigger
SELECT tests.authenticate_as_service_role();
SELECT throws_ok(
    format($$UPDATE public.stock_movements SET delta = 999 WHERE product_id = %s$$, :s29_prod_id),
    '42501',
    'stock_movements is append-only; update and delete are prohibited',
    'S29: Direct UPDATE on stock_movements is blocked'
);

-- 22. Direct DELETE on stock_movements is blocked by immutability trigger
SELECT throws_ok(
    format($$DELETE FROM public.stock_movements WHERE product_id = %s$$, :s29_prod_id),
    '42501',
    'stock_movements is append-only; update and delete are prohibited',
    'S29: Direct DELETE on stock_movements is blocked'
);

SELECT * FROM finish();
ROLLBACK;

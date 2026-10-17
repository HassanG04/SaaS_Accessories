BEGIN;

SELECT plan(22);

-- ============================================================================
-- Setup for cancel and restock tests
-- ============================================================================

INSERT INTO public.delivery_fees (governorate_id, method, fee)
VALUES (1, 'representative', 35.00)
ON CONFLICT (governorate_id, method) DO NOTHING;

SELECT tests.create_supabase_user(
    'buyer_cancel_a',
    'buyer_a@example.com',
    '01011112222',
    '{"full_name": "Buyer A"}'::jsonb
);

SELECT tests.create_supabase_user(
    'buyer_cancel_b',
    'buyer_b@example.com',
    '01033334444',
    '{"full_name": "Buyer B"}'::jsonb
);

SELECT tests.create_supabase_user(
    'admin_cancel',
    'admin_cancel@example.com',
    '01055556666',
    '{"full_name": "Admin Cancel"}'::jsonb
);

-- Promote admin_cancel to admin
UPDATE public.profiles
   SET role = 'admin'
 WHERE id = tests.get_supabase_uid('admin_cancel');

-- ============================================================================
-- Scenario S10: Admin updates only fulfilment fields; cancelling restocks; reopening is blocked
-- ============================================================================

-- Buyer A places an order for Product 2 ('Gold hoop earrings', stock 5, sold 0) with quantity 2
SELECT tests.authenticate_as('buyer_cancel_a');

SELECT public.place_order(
    jsonb_build_array(
        jsonb_build_object(
            'product_id', (SELECT id FROM public.products WHERE name = 'Gold hoop earrings'),
            'quantity', 2
        )
    ),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer A', 'phone', '01011112222', 'governorate_id', 1::smallint, 'city', 'Cairo', 'address', 'Address A', 'notes', NULL)
) AS s10_order_id \gset

SELECT ok(
    :'s10_order_id' IS NOT NULL AND :'s10_order_id' > 0,
    'S10: Order created successfully'
);

-- Stock of Product 2 is now 3, sold_count is 2

-- Switch to admin
SELECT tests.authenticate_as('admin_cancel');

-- 1. Admin updates status, tracking and rep fields
UPDATE public.orders
   SET status = 'shipped',
       tracking_number = 'TRACK-789',
       rep_name = 'Captain Kareem',
       rep_phone = '01099998888'
 WHERE id = :'s10_order_id';

SELECT is(
    (SELECT status::text FROM public.orders WHERE id = :'s10_order_id'),
    'shipped',
    'S10: Admin can update order status to shipped'
);

SELECT is(
    (SELECT tracking_number FROM public.orders WHERE id = :'s10_order_id'),
    'TRACK-789',
    'S10: Admin can update tracking_number'
);

SELECT is(
    (SELECT rep_name FROM public.orders WHERE id = :'s10_order_id'),
    'Captain Kareem',
    'S10: Admin can update rep_name'
);

SELECT is(
    (SELECT rep_phone FROM public.orders WHERE id = :'s10_order_id'),
    '01099998888',
    'S10: Admin can update rep_phone'
);

-- 2. Admin cannot update non-fulfilment columns directly (subtotal, total, etc.)
SELECT throws_ok(
    format('UPDATE public.orders SET subtotal = 10.00 WHERE id = %s', :'s10_order_id'),
    '42501',
    NULL,
    'S10: Admin cannot update order financial columns directly (permission denied)'
);

-- 3. Admin cancels the order -> triggers restock via orders_status_guard
UPDATE public.orders
   SET status = 'cancelled'
 WHERE id = :'s10_order_id';

SELECT is(
    (SELECT status::text FROM public.orders WHERE id = :'s10_order_id'),
    'cancelled',
    'S10: Order status updated to cancelled'
);

-- Product 2 was stock 3, sold 2 -> should be restored to stock 5, sold 0
SELECT is(
    (SELECT stock_quantity FROM public.products WHERE name = 'Gold hoop earrings'),
    5,
    'S10: Cancelling restocked product quantity back to original (3 + 2 = 5)'
);

SELECT is(
    (SELECT sold_count FROM public.products WHERE name = 'Gold hoop earrings'),
    0,
    'S10: Cancelling decremented product sold_count back to 0 (2 - 2 = 0)'
);

-- 4. Reopening a cancelled order is blocked by orders_status_guard
SELECT throws_ok(
    format('UPDATE public.orders SET status = ''pending'' WHERE id = %s', :'s10_order_id'),
    '22023',
    'A cancelled order cannot be re-opened',
    'S10: Reopening a cancelled order is rejected by status guard trigger'
);

SELECT is(
    (SELECT status::text FROM public.orders WHERE id = :'s10_order_id'),
    'cancelled',
    'S10: Order remains cancelled after blocked reopen attempt'
);

-- Product stock still untouched
SELECT is(
    (SELECT stock_quantity FROM public.products WHERE name = 'Gold hoop earrings'),
    5,
    'S10: Stock unchanged after blocked reopen attempt'
);

-- ============================================================================
-- Scenario S11: Customer cancels own pending order; shipped and others are refused
-- ============================================================================

-- Product 1: 'Pearl drop earrings', stock = 12, sold = 0

-- Buyer A places pending Order A1 (qty 2)
SELECT tests.authenticate_as('buyer_cancel_a');

SELECT public.place_order(
    jsonb_build_array(
        jsonb_build_object(
            'product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'),
            'quantity', 2
        )
    ),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer A', 'phone', '01011112222', 'governorate_id', 1::smallint, 'city', 'Cairo', 'address', 'Addr A', 'notes', NULL)
) AS order_a1 \gset

-- Buyer B places pending Order B1 (qty 1)
SELECT tests.authenticate_as('buyer_cancel_b');

SELECT public.place_order(
    jsonb_build_array(
        jsonb_build_object(
            'product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'),
            'quantity', 1
        )
    ),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer B', 'phone', '01033334444', 'governorate_id', 1::smallint, 'city', 'Cairo', 'address', 'Addr B', 'notes', NULL)
) AS order_b1 \gset

-- Buyer A places Order A2 (qty 1)
SELECT tests.authenticate_as('buyer_cancel_a');

SELECT public.place_order(
    jsonb_build_array(
        jsonb_build_object(
            'product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'),
            'quantity', 1
        )
    ),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer A', 'phone', '01011112222', 'governorate_id', 1::smallint, 'city', 'Cairo', 'address', 'Addr A', 'notes', NULL)
) AS order_a2 \gset

-- Stock is now: 12 - 2 - 1 - 1 = 8. Sold count is 4.

-- Admin marks Order A2 as 'shipped'
SELECT tests.authenticate_as('admin_cancel');

UPDATE public.orders
   SET status = 'shipped'
 WHERE id = :'order_a2';

-- Switch to Buyer A
SELECT tests.authenticate_as('buyer_cancel_a');

-- 1. Buyer A cancels own pending order (Order A1)
SELECT public.cancel_my_order(:'order_a1');

SELECT is(
    (SELECT status::text FROM public.orders WHERE id = :'order_a1'),
    'cancelled',
    'S11: Customer can cancel their own pending order'
);

-- Product 1 stock restored by 2 (8 + 2 = 10), sold count 4 - 2 = 2
SELECT is(
    (SELECT stock_quantity FROM public.products WHERE name = 'Pearl drop earrings'),
    10,
    'S11: Customer cancellation restored stock quantity (8 + 2 = 10)'
);

SELECT is(
    (SELECT sold_count FROM public.products WHERE name = 'Pearl drop earrings'),
    2,
    'S11: Customer cancellation decremented sold_count (4 - 2 = 2)'
);

-- 2. Buyer A attempts to cancel Buyer B's pending order (Order B1) -> refused
SELECT throws_ok(
    format('SELECT public.cancel_my_order(%s)', :'order_b1'),
    '22023',
    'Order not found, or it can no longer be cancelled',
    'S11: Customer cannot cancel another users order'
);

-- Buyer A cannot see Buyer B's order
SELECT is_empty(
    format('SELECT id FROM public.orders WHERE id = %s', :'order_b1'),
    'S11: Buyer A cannot see Buyer B order under RLS'
);

-- Authenticate as Buyer B to check order is still pending
SELECT tests.authenticate_as('buyer_cancel_b');

SELECT is(
    (SELECT status::text FROM public.orders WHERE id = :'order_b1'),
    'pending',
    'S11: Other users order remains pending'
);

-- Switch back to Buyer A
SELECT tests.authenticate_as('buyer_cancel_a');

SELECT is(
    (SELECT stock_quantity FROM public.products WHERE name = 'Pearl drop earrings'),
    10,
    'S11: Stock unaffected after refused cancellation of other users order'
);

-- 3. Buyer A attempts to cancel their own shipped order (Order A2) -> refused
SELECT throws_ok(
    format('SELECT public.cancel_my_order(%s)', :'order_a2'),
    '22023',
    'Order not found, or it can no longer be cancelled',
    'S11: Customer cannot cancel a shipped order'
);

SELECT is(
    (SELECT status::text FROM public.orders WHERE id = :'order_a2'),
    'shipped',
    'S11: Shipped order remains shipped'
);

SELECT is(
    (SELECT stock_quantity FROM public.products WHERE name = 'Pearl drop earrings'),
    10,
    'S11: Stock unaffected after refused cancellation of shipped order'
);

SELECT * FROM finish();
ROLLBACK;

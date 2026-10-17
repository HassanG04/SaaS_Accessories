BEGIN;

SELECT plan(36);

-- ============================================================================
-- Setup for T-1.23 Order Approval and Saved Address (Scenarios S32 to S37)
-- ============================================================================

SELECT tests.create_supabase_user(
    'admin_s32',
    'admin_s32@example.com',
    '01011110032',
    '{"full_name": "Admin S32"}'::jsonb
);

SELECT tests.create_supabase_user(
    'customer1_s32',
    'customer1_s32@example.com',
    '01022220032',
    '{"full_name": "Customer 1 S32"}'::jsonb
);

SELECT tests.create_supabase_user(
    'customer2_s32',
    'customer2_s32@example.com',
    '01033330032',
    '{"full_name": "Customer 2 S32"}'::jsonb
);

-- Promote admin_s32 to admin as database owner
UPDATE public.profiles
   SET role = 'admin'
 WHERE id = tests.get_supabase_uid('admin_s32');

-- Ensure delivery fee exists for governorate 1
INSERT INTO public.delivery_fees (governorate_id, method, fee)
VALUES (1, 'representative', 35.00)
ON CONFLICT (governorate_id, method) DO NOTHING;

-- Configure shop settings for test
SELECT tests.authenticate_as('admin_s32', 'aal2');
SELECT public.admin_update_setting('require_order_approval', 'true'::jsonb);
SELECT public.admin_update_setting('approval_window_hours', '24'::jsonb);
SELECT public.admin_update_setting('payment_methods_enabled', '["cod", "instapay_qr"]'::jsonb);

-- Create test product with stock 50
INSERT INTO public.products (
    category_id, name, name_ar, price, stock_quantity, is_active
) VALUES (
    (SELECT id FROM public.categories LIMIT 1),
    'S32 Test Product',
    'منتج اختبار S32',
    100.00,
    50,
    true
) RETURNING id AS s32_product_id \gset

-- ============================================================================
-- 1. Scenario S32: Order approval flow (admin_approve_order)
-- ============================================================================

-- Customer1 places an instapay_qr order with approval required
SELECT tests.authenticate_as('customer1_s32');
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :'s32_product_id', 'quantity', 1)),
    'representative',
    'instapay_qr',
    jsonb_build_object('postal_code', '11511', 'name', 'Nour', 'phone', '01012345678', 'governorate_id', 1, 'address', 'Maadi Degla')
) AS s32_order1 \gset

-- 1. Order status is pending, payment_status is awaiting_approval, no deadline
SELECT is(
    (SELECT (status, payment_status, payment_deadline IS NULL) FROM public.orders WHERE id = :'s32_order1'),
    ROW('pending'::public.order_status, 'awaiting_approval'::public.payment_status, true),
    'S32: New order starts as pending with awaiting_approval and no payment deadline'
);

-- 2. Product stock decremented from 50 to 49
SELECT is(
    (SELECT stock_quantity FROM public.products WHERE id = :'s32_product_id'),
    49,
    'S32: Stock held for awaiting_approval order'
);

-- 3. Customer calling admin_approve_order raises ADM-001 (42501)
SELECT throws_ok(
    format($$SELECT public.admin_approve_order(%s, 'Approved')$$, :'s32_order1'),
    '42501',
    'Admins only',
    'S32: Customer calling admin_approve_order raises ADM-001'
);

-- 4. Admin at aal1 calling admin_approve_order raises ADM-002 (42501)
SELECT tests.authenticate_as('admin_s32', 'aal1');
SELECT throws_ok(
    format($$SELECT public.admin_approve_order(%s, 'Approved')$$, :'s32_order1'),
    '42501',
    'Two-factor authentication required for admin actions',
    'S32: Admin at aal1 calling admin_approve_order raises ADM-002'
);

-- 5. Admin at aal2 calls admin_approve_order succeeds
SELECT tests.authenticate_as('admin_s32', 'aal2');
SELECT lives_ok(
    format($$SELECT public.admin_approve_order(%s, 'Confirmed by store')$$, :'s32_order1'),
    'S32: Admin at aal2 approves order successfully'
);

-- 6. Order status is confirmed, payment_status is awaiting_proof, payment_deadline is set
SELECT is(
    (SELECT (status, payment_status, payment_deadline IS NOT NULL, payment_review_note) FROM public.orders WHERE id = :'s32_order1'),
    ROW('confirmed'::public.order_status, 'awaiting_proof'::public.payment_status, true, 'Confirmed by store'::text),
    'S32: Approved order is confirmed, awaiting_proof with deadline and note set'
);

-- 7. Audit log records ORDER_APPROVE event
SELECT ok(
    EXISTS (
        SELECT 1 FROM public.audit_log
         WHERE entity = 'orders'
           AND entity_id = :'s32_order1'::text
           AND action = 'ORDER_APPROVE'
    ),
    'S32: Order approval is recorded in audit_log'
);

-- 8. Calling admin_approve_order on already approved order raises PAY-004 (22023)
SELECT throws_ok(
    format($$SELECT public.admin_approve_order(%s, 'Again')$$, :'s32_order1'),
    '22023',
    'Order is not awaiting approval',
    'S32: Approving already confirmed order raises PAY-004'
);

-- 9. Customer can now get payment instructions
SELECT tests.authenticate_as('customer1_s32');
SELECT ok(
    (public.get_payment_instructions(:'s32_order1') ->> 'amount')::numeric = 135.00
    AND (public.get_payment_instructions(:'s32_order1') ->> 'deadline') IS NOT NULL,
    'S32: Customer can retrieve payment instructions with correct amount and deadline'
);

-- ============================================================================
-- 2. Scenario S33: Order rejection flow (admin_reject_order)
-- ============================================================================

-- Customer1 places another order to test rejection
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :'s32_product_id', 'quantity', 1)),
    'representative',
    'instapay_qr',
    jsonb_build_object('postal_code', '11511', 'name', 'Nour', 'phone', '01012345678', 'governorate_id', 1, 'address', 'Maadi Degla')
) AS s32_order2 \gset

-- 10. Customer calling admin_reject_order raises ADM-001 (42501)
SELECT throws_ok(
    format($$SELECT public.admin_reject_order(%s, 'Out of stock')$$, :'s32_order2'),
    '42501',
    'Admins only',
    'S33: Customer calling admin_reject_order raises ADM-001'
);

-- 11. Admin at aal1 calling admin_reject_order raises ADM-002 (42501)
SELECT tests.authenticate_as('admin_s32', 'aal1');
SELECT throws_ok(
    format($$SELECT public.admin_reject_order(%s, 'Out of stock')$$, :'s32_order2'),
    '42501',
    'Two-factor authentication required for admin actions',
    'S33: Admin at aal1 calling admin_reject_order raises ADM-002'
);

-- 12. Admin at aal2 calling with empty reason raises ADM-007 (22023)
SELECT tests.authenticate_as('admin_s32', 'aal2');
SELECT throws_ok(
    format($$SELECT public.admin_reject_order(%s, '   ')$$, :'s32_order2'),
    '22023',
    'Rejection reason required',
    'S33: Empty rejection reason raises ADM-007'
);

-- 13. Admin at aal2 rejects order with reason
SELECT lives_ok(
    format($$SELECT public.admin_reject_order(%s, 'Unavailable color variation')$$, :'s32_order2'),
    'S33: Admin at aal2 rejects order with reason'
);

-- 14. Order status is cancelled and rejection reason is saved
SELECT is(
    (SELECT (status, payment_review_note) FROM public.orders WHERE id = :'s32_order2'),
    ROW('cancelled'::public.order_status, 'Unavailable color variation'::text),
    'S33: Order status is cancelled and rejection reason saved'
);

-- 15. Inventory restored back to 49 (was decremented to 48 on order2, then restored on rejection)
SELECT is(
    (SELECT stock_quantity FROM public.products WHERE id = :'s32_product_id'),
    49,
    'S33: Inventory restocked automatically on admin rejection'
);

-- 16. Audit log records ORDER_REJECT event
SELECT ok(
    EXISTS (
        SELECT 1 FROM public.audit_log
         WHERE entity = 'orders'
           AND entity_id = :'s32_order2'::text
           AND action = 'ORDER_REJECT'
    ),
    'S33: Order rejection is recorded in audit_log'
);

-- 17. Rejecting cancelled order raises PAY-004 (22023)
SELECT throws_ok(
    format($$SELECT public.admin_reject_order(%s, 'Duplicate')$$, :'s32_order2'),
    '22023',
    'Order is not awaiting approval',
    'S33: Rejecting already cancelled order raises PAY-004'
);

-- ============================================================================
-- 3. Scenario S35: Refusal of payment instructions & proof before approval
-- ============================================================================

-- Customer1 places order3
SELECT tests.authenticate_as('customer1_s32');
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :'s32_product_id', 'quantity', 1)),
    'representative',
    'instapay_qr',
    jsonb_build_object('postal_code', '11511', 'name', 'Nour', 'phone', '01012345678', 'governorate_id', 1, 'address', 'Maadi Degla')
) AS s32_order3 \gset

-- 18. Customer calling get_payment_instructions before approval raises PAY-007 (22023)
SELECT throws_ok(
    format($$SELECT public.get_payment_instructions(%s)$$, :'s32_order3'),
    '22023',
    'Order is awaiting store approval',
    'S35: get_payment_instructions before approval raises PAY-007'
);

-- 19. Customer calling submit_payment_proof before approval raises PAY-007 (22023)
SELECT throws_ok(
    format($$SELECT public.submit_payment_proof(
        %s,
        'REF-S35-TEST',
        format('%%s/%s/proof.jpg', tests.get_supabase_uid('customer1_s32'))
    )$$, :'s32_order3', :'s32_order3'),
    '22023',
    'Order is awaiting store approval',
    'S35: submit_payment_proof before approval raises PAY-007'
);

-- ============================================================================
-- 4. Scenario S34: Enforce ORD-015 (cannot ship unpaid InstaPay order)
-- ============================================================================

-- For order1 (which is confirmed, awaiting_proof):
-- 20. Updating status to shipped while unpaid raises ORD-015 (22023)
SELECT tests.authenticate_as('admin_s32', 'aal2');
SELECT throws_ok(
    format($$UPDATE public.orders SET status = 'shipped' WHERE id = %s$$, :'s32_order1'),
    '22023',
    'Cannot ship unpaid InstaPay order',
    'S34: Updating unpaid InstaPay order to shipped raises ORD-015'
);

-- 21. Updating status to delivered while unpaid raises ORD-015 (22023)
SELECT throws_ok(
    format($$UPDATE public.orders SET status = 'delivered' WHERE id = %s$$, :'s32_order1'),
    '22023',
    'Cannot ship unpaid InstaPay order',
    'S34: Updating unpaid InstaPay order to delivered raises ORD-015'
);

-- Customer1 submits proof for order1
SELECT tests.authenticate_as('customer1_s32');
SELECT lives_ok(
    format($$SELECT public.submit_payment_proof(
        %s,
        'REF-S34-ORDER1',
        format('%%s/%s/receipt.jpg', tests.get_supabase_uid('customer1_s32'))
    )$$, :'s32_order1', :'s32_order1'),
    'S34: Customer submits proof for approved order'
);

-- 22. Status under_review still cannot be shipped (ORD-015)
SELECT tests.authenticate_as('admin_s32', 'aal2');
SELECT throws_ok(
    format($$UPDATE public.orders SET status = 'shipped' WHERE id = %s$$, :'s32_order1'),
    '22023',
    'Cannot ship unpaid InstaPay order',
    'S34: Under review InstaPay order cannot be marked shipped'
);

-- Admin reviews and marks paid
SELECT public.admin_review_payment(:'s32_order1', true, 'Payment received on bank');

-- 23. Order is paid
SELECT is(
    (SELECT payment_status FROM public.orders WHERE id = :'s32_order1'),
    'paid'::public.payment_status,
    'S34: Order payment_status is paid'
);

-- 24. Shipped status is now allowed
SELECT lives_ok(
    format($$UPDATE public.orders SET status = 'shipped' WHERE id = %s$$, :'s32_order1'),
    'S34: Paid InstaPay order can transition to shipped'
);

-- 25. Delivered status is also allowed
SELECT lives_ok(
    format($$UPDATE public.orders SET status = 'delivered' WHERE id = %s$$, :'s32_order1'),
    'S34: Paid InstaPay order can transition to delivered'
);

-- ============================================================================
-- 5. Scenario S36: expire_unpaid_orders cancels unapproved orders past window
-- ============================================================================

-- Customer1 places order4
SELECT tests.authenticate_as('customer1_s32');
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :'s32_product_id', 'quantity', 1)),
    'representative',
    'instapay_qr',
    jsonb_build_object('postal_code', '11511', 'name', 'Nour', 'phone', '01012345678', 'governorate_id', 1, 'address', 'Maadi Degla')
) AS s32_order4 \gset

-- Stock before expiration is 47
SELECT is(
    (SELECT stock_quantity FROM public.products WHERE id = :'s32_product_id'),
    47,
    'S36: Stock is 47 before order expiration'
);

-- Backdate order4 created_at to 25 hours ago as postgres/owner
SELECT set_config('role', 'postgres', true);
UPDATE public.orders
   SET created_at = now() - interval '25 hours'
 WHERE id = :'s32_order4';

-- 26. expire_unpaid_orders cancels overdue unapproved order
SELECT tests.authenticate_as('admin_s32', 'aal2');
SELECT cmp_ok(
    public.expire_unpaid_orders(),
    '>=',
    1,
    'S36: expire_unpaid_orders cancels overdue unapproved order'
);

-- 27. order4 status is cancelled with note
SELECT is(
    (SELECT (status, payment_review_note) FROM public.orders WHERE id = :'s32_order4'),
    ROW('cancelled'::public.order_status, 'Approval window expired'::text),
    'S36: Overdue unapproved order is cancelled with expiration note'
);

-- 28. Stock is restored back to 48
SELECT is(
    (SELECT stock_quantity FROM public.products WHERE id = :'s32_product_id'),
    48,
    'S36: Stock is restored back to 48 after order expiry'
);

-- ============================================================================
-- 6. Scenario S37: get_payment_instructions access control
-- ============================================================================

-- 29. Anon calling get_payment_instructions raises AUTH-004 (42501)
SELECT tests.clear_authentication();
SELECT throws_ok(
    format($$SELECT public.get_payment_instructions(%s)$$, :'s32_order1'),
    '42501',
    NULL,
    'S37: Anon calling get_payment_instructions raises AUTH-004'
);

-- 30. Other customer calling get_payment_instructions raises ORD-009 (42501)
SELECT tests.authenticate_as('customer2_s32');
SELECT throws_ok(
    format($$SELECT public.get_payment_instructions(%s)$$, :'s32_order1'),
    '42501',
    'Not owner of order',
    'S37: Non-owner calling get_payment_instructions raises ORD-009'
);

-- ============================================================================
-- 7. Saved address synchronization on place_order
-- ============================================================================

-- Customer2 has no saved address initially
SELECT is(
    (SELECT (address, city) FROM public.profiles WHERE id = tests.get_supabase_uid('customer2_s32')),
    ROW(NULL::text, NULL::text),
    'Saved address: Customer2 starts with no address'
);

-- 31. Customer2 places order with new address and save_address = true
SELECT tests.authenticate_as('customer2_s32');
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :'s32_product_id', 'quantity', 1)),
    'representative',
    'cod',
    jsonb_build_object('postal_code', '11511',
        'name', 'Kareem',
        'phone', '01033330032',
        'governorate_id', 1,
        'city', 'Cairo',
        'district', 'Zamalek',
        'address', '15 Brazil St',
        'floor', '3',
        'apartment', '7',
        'landmark', 'Near Gezira Club',
        'save_address', true
    )
);

-- 32. Profile is automatically updated with the shipping address
SELECT is(
    (SELECT (address, city, district) FROM public.profiles WHERE id = tests.get_supabase_uid('customer2_s32')),
    ROW('15 Brazil St'::text, 'Cairo'::text, 'Zamalek'::text),
    'Saved address: Customer2 profile populated with saved address'
);

-- 33. Customer2 places another order with different address but save_address = false
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :'s32_product_id', 'quantity', 1)),
    'representative',
    'cod',
    jsonb_build_object('postal_code', '11511',
        'name', 'Kareem Work',
        'phone', '01033330032',
        'governorate_id', 1,
        'city', 'Giza',
        'district', 'Dokki',
        'address', '90 Mosaddak St',
        'save_address', false
    )
);

-- 34. Profile address is NOT overwritten when save_address is false
SELECT is(
    (SELECT address FROM public.profiles WHERE id = tests.get_supabase_uid('customer2_s32')),
    '15 Brazil St',
    'Saved address: Profile address unchanged when save_address is false'
);

-- 35. Customer2 places order with save_address = true, overwriting the saved address
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :'s32_product_id', 'quantity', 1)),
    'representative',
    'cod',
    jsonb_build_object('postal_code', '11511',
        'name', 'Kareem New Home',
        'phone', '01033330032',
        'governorate_id', 1,
        'city', 'New Cairo',
        'district', 'Fifth Settlement',
        'address', '100 South 90th St',
        'save_address', true
    )
);

SELECT is(
    (SELECT address FROM public.profiles WHERE id = tests.get_supabase_uid('customer2_s32')),
    '100 South 90th St',
    'Saved address: Profile address updated when save_address is true'
);

SELECT * FROM finish();
ROLLBACK;

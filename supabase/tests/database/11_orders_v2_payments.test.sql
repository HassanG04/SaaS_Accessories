BEGIN;

SELECT plan(38);

-- ============================================================================
-- Setup for T-1.18 Orders v2 and Payments (Scenarios S23, S24, S25)
-- ============================================================================

SELECT tests.create_supabase_user(
    'admin_s23',
    'admin_s23@example.com',
    '01011110023',
    '{"full_name": "Admin S23"}'::jsonb
);

SELECT tests.create_supabase_user(
    'customer1_s23',
    'customer1_s23@example.com',
    '01022220023',
    '{"full_name": "Customer 1 S23"}'::jsonb
);

SELECT tests.create_supabase_user(
    'customer2_s23',
    'customer2_s23@example.com',
    '01033330023',
    '{"full_name": "Customer 2 S23"}'::jsonb
);

-- Promote admin_s23 to admin as database owner
UPDATE public.profiles
   SET role = 'admin'
 WHERE id = tests.get_supabase_uid('admin_s23');

-- Ensure delivery fee exists for governorate 1
INSERT INTO public.delivery_fees (governorate_id, method, fee)
VALUES (1, 'representative', 35.00)
ON CONFLICT (governorate_id, method) DO NOTHING;

-- Create test product
INSERT INTO public.products (
    category_id, name, name_ar, price, stock_quantity, is_active
) VALUES (
    (SELECT id FROM public.categories LIMIT 1),
    'S23 Test Product',
    'منتج اختبار S23',
    100.00,
    50,
    true
) RETURNING id AS s23_product_id \gset

-- Disable order approval requirement for direct payment tests in this suite
UPDATE public.shop_settings
   SET value = 'false'::jsonb
 WHERE key = 'require_order_approval';

-- ============================================================================
-- 1. Scenario S23: Orders v2, address validation, payment methods, COD auto-pay
-- ============================================================================

-- 1. Anon calling place_order is denied with AUTH-004
SELECT tests.clear_authentication();
SELECT throws_ok(
    format($$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 1)),
    'representative',
    'instapay_qr',
    jsonb_build_object('postal_code', '11511', 'name', 'Ali', 'phone', '01012345678', 'governorate_id', 1, 'address', 'Nasr City')
)$$, :'s23_product_id'),
    '42501',
    'Authentication required',
    'S23: Anon calling place_order raises AUTH-004'
);

-- 2. Authenticate as Customer 1, empty cart raises ORD-001 (22023)
SELECT tests.authenticate_as('customer1_s23');
SELECT throws_ok(
    $$SELECT public.place_order(
    '[]'::jsonb,
    'representative',
    'instapay_qr',
    jsonb_build_object('postal_code', '11511', 'name', 'Ali', 'phone', '01012345678', 'governorate_id', 1, 'address', 'Nasr City')
)$$,
    '22023',
    'Cart is empty',
    'S23: Empty cart raises ORD-001'
);

-- 3. Disabled payment method raises ORD-011 (22023)
-- Temporarily disable instapay_qr in shop_settings
SELECT tests.authenticate_as('admin_s23', 'aal2');
SELECT public.admin_update_setting('payment_methods_enabled', '["cod"]'::jsonb);

SELECT tests.authenticate_as('customer1_s23');
SELECT throws_ok(
    format($$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 1)),
    'representative',
    'instapay_qr',
    jsonb_build_object('postal_code', '11511', 'name', 'Ali', 'phone', '01012345678', 'governorate_id', 1, 'address', 'Nasr City')
)$$, :'s23_product_id'),
    '22023',
    'Payment method is disabled',
    'S23: Disabled payment method raises ORD-011'
);

-- Re-enable instapay_qr
SELECT tests.authenticate_as('admin_s23', 'aal2');
SELECT public.admin_update_setting('payment_methods_enabled', '["cod", "instapay_qr"]'::jsonb);

-- 4. Address validation: missing governorate_id raises ORD-003
SELECT tests.authenticate_as('customer1_s23');
SELECT throws_ok(
    format($$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 1)),
    'representative',
    'instapay_qr',
    jsonb_build_object('postal_code', '11511', 'name', 'Ali', 'phone', '01012345678', 'address', 'Nasr City')
)$$, :'s23_product_id'),
    '22023',
    'Governorate ID required',
    'S23: Missing governorate_id raises ORD-003'
);

-- 5. Address validation: missing / empty recipient name raises ORD-012
SELECT throws_ok(
    format($$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 1)),
    'representative',
    'instapay_qr',
    jsonb_build_object('postal_code', '11511', 'name', '', 'phone', '01012345678', 'governorate_id', 1, 'address', 'Nasr City')
)$$, :'s23_product_id'),
    '22023',
    'Invalid shipping field length or missing required fields',
    'S23: Empty recipient name raises ORD-012'
);

-- 6. Address validation: oversize name (> 100 chars) raises ORD-012
SELECT throws_ok(
    format($$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 1)),
    'representative',
    'instapay_qr',
    jsonb_build_object('postal_code', '11511', 'name', repeat('A', 101), 'phone', '01012345678', 'governorate_id', 1, 'address', 'Nasr City')
)$$, :'s23_product_id'),
    '22023',
    'Invalid shipping field length or missing required fields',
    'S23: Oversize recipient name raises ORD-012'
);

-- 7. Address validation: missing / empty address raises ORD-012
SELECT throws_ok(
    format($$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 1)),
    'representative',
    'instapay_qr',
    jsonb_build_object('postal_code', '11511', 'name', 'Ali', 'phone', '01012345678', 'governorate_id', 1, 'address', '')
)$$, :'s23_product_id'),
    '22023',
    'Invalid shipping field length or missing required fields',
    'S23: Empty address raises ORD-012'
);

-- 8. Valid place_order with instapay_qr succeeds and returns order ID
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :'s23_product_id', 'quantity', 2)),
    'representative',
    'instapay_qr',
    jsonb_build_object('postal_code', '11511',
        'name', 'Ahmed Hassan',
        'phone', '01012345678',
        'alt_phone', '01098765432',
        'governorate_id', 1,
        'city', 'Cairo',
        'district', 'Nasr City',
        'address', '15 Abbas El Akkad',
        'floor', '3',
        'apartment', '32',
        'landmark', 'Near Genena Mall',
        'notes', 'Call before arrival'
    )
) AS s23_order_instapay \gset

SELECT is(
    (:'s23_order_instapay' > 0),
    true,
    'S23: place_order with instapay_qr succeeds'
);

-- 9. Check instapay order fields: payment_status = awaiting_proof
SELECT is(
    (SELECT payment_status FROM public.orders WHERE id = :'s23_order_instapay'),
    'awaiting_proof'::public.payment_status,
    'S23: instapay_qr order has payment_status awaiting_proof'
);

-- 10. Check instapay order has payment_deadline set in the future
SELECT is(
    (SELECT payment_deadline > now() FROM public.orders WHERE id = :'s23_order_instapay'),
    true,
    'S23: instapay_qr order has payment_deadline in future'
);

-- 11. Check structured address columns stored properly
SELECT is(
    (SELECT (ship_district, ship_floor, ship_apartment, ship_landmark)
       FROM public.orders WHERE id = :'s23_order_instapay'),
    ROW('Nasr City'::text, '3'::text, '32'::text, 'Near Genena Mall'::text),
    'S23: Structured shipping fields stored properly in orders'
);

-- 12. Check stock decremented
SELECT is(
    (SELECT stock_quantity FROM public.products WHERE id = :'s23_product_id'),
    48,
    'S23: Product stock decremented by 2'
);

-- 13. Valid place_order with COD succeeds
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :'s23_product_id', 'quantity', 1)),
    'representative',
    'cod',
    jsonb_build_object('postal_code', '11511',
        'name', 'Ahmed COD',
        'phone', '01012345678',
        'governorate_id', 1,
        'address', 'Tahrir Sq'
    )
) AS s23_order_cod \gset

SELECT is(
    (SELECT payment_status FROM public.orders WHERE id = :'s23_order_cod'),
    'unpaid'::public.payment_status,
    'S23: COD order starts with payment_status unpaid'
);

-- 14. COD order has no payment deadline
SELECT is(
    (SELECT payment_deadline FROM public.orders WHERE id = :'s23_order_cod'),
    NULL::timestamptz,
    'S23: COD order has payment_deadline NULL'
);

-- 15. COD auto-pay on delivery: status update to shipped leaves payment_status unpaid
SELECT tests.authenticate_as('admin_s23', 'aal2');
UPDATE public.orders SET status = 'shipped' WHERE id = :'s23_order_cod';

SELECT is(
    (SELECT payment_status FROM public.orders WHERE id = :'s23_order_cod'),
    'unpaid'::public.payment_status,
    'S23: COD order status shipped does not mark paid'
);

-- 16. COD auto-pay on delivery: status update to delivered sets payment_status paid & paid_at
UPDATE public.orders SET status = 'delivered' WHERE id = :'s23_order_cod';

SELECT is(
    (SELECT payment_status FROM public.orders WHERE id = :'s23_order_cod'),
    'paid'::public.payment_status,
    'S23: COD order status delivered automatically sets payment_status = paid'
);

-- 17. COD auto-pay sets paid_at timestamp
SELECT ok(
    (SELECT paid_at IS NOT NULL FROM public.orders WHERE id = :'s23_order_cod'),
    'S23: COD order delivered automatically populates paid_at'
);

-- ============================================================================
-- 2. Scenario S24: Payment proof submission, validation, review and resubmission
-- ============================================================================

-- 18. Customer 2 trying to submit proof for Customer 1's order raises ORD-009 (42501)
SELECT tests.authenticate_as('customer2_s23');
SELECT throws_ok(
    format($$SELECT public.submit_payment_proof(
        %s,
        'REF-12345',
        format('%%s/%s/proof.jpg', tests.get_supabase_uid('customer1_s23'))
    )$$, :'s23_order_instapay', :'s23_order_instapay'),
    '42501',
    'Not owner of order',
    'S24: Non-owner submitting proof raises ORD-009'
);

-- 19. Customer 1 submitting proof for COD order raises PAY-004 (22023)
SELECT tests.authenticate_as('customer1_s23');
SELECT throws_ok(
    format($$SELECT public.submit_payment_proof(
        %s,
        'REF-COD',
        format('%%s/%s/proof.jpg', tests.get_supabase_uid('customer1_s23'))
    )$$, :'s23_order_cod', :'s23_order_cod'),
    '22023',
    'Wrong payment method',
    'S24: Submitting proof for COD order raises PAY-004'
);

-- 20. Empty payment reference raises PAY-003 (22023)
SELECT throws_ok(
    format($$SELECT public.submit_payment_proof(
        %s,
        '   ',
        format('%%s/%s/proof.jpg', tests.get_supabase_uid('customer1_s23'))
    )$$, :'s23_order_instapay', :'s23_order_instapay'),
    '22023',
    'Payment reference required',
    'S24: Empty payment reference raises PAY-003'
);

-- 21. Proof path not starting with <uid>/<order_id>/ raises PAY-004 (22023)
SELECT throws_ok(
    format($$SELECT public.submit_payment_proof(
        %s,
        'REF-12345',
        'random_folder/proof.jpg'
    )$$, :'s23_order_instapay'),
    '22023',
    'Proof path must start with user and order ID',
    'S24: Invalid proof path prefix raises PAY-004'
);

-- 22. Valid payment proof submission succeeds
SELECT lives_ok(
    format($$SELECT public.submit_payment_proof(
        %s,
        'REF-12345',
        format('%%s/%s/receipt.jpg', tests.get_supabase_uid('customer1_s23'))
    )$$, :'s23_order_instapay', :'s23_order_instapay'),
    'S24: Valid submit_payment_proof succeeds'
);

-- 23. Order is now under_review
SELECT is(
    (SELECT payment_status FROM public.orders WHERE id = :'s23_order_instapay'),
    'under_review'::public.payment_status,
    'S24: Order payment_status moved to under_review'
);

-- 24. Duplicate payment reference on another order raises PAY-005 (23505)
SELECT tests.authenticate_as('customer2_s23');
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :'s23_product_id', 'quantity', 1)),
    'representative',
    'instapay_qr',
    jsonb_build_object('postal_code', '11511', 'name', 'Cust 2', 'phone', '01012345678', 'governorate_id', 1, 'address', 'Maadi')
) AS s23_order2_instapay \gset

SELECT throws_ok(
    format($$SELECT public.submit_payment_proof(
        %s,
        'REF-12345',
        format('%%s/%s/receipt2.jpg', tests.get_supabase_uid('customer2_s23'))
    )$$, :'s23_order2_instapay', :'s23_order2_instapay'),
    '23505',
    'Duplicate payment reference',
    'S24: Duplicate reference raises PAY-005'
);

-- 25. Customer calling admin_review_payment raises ADM-001 (42501)
SELECT throws_ok(
    format($$SELECT public.admin_review_payment(%s, true)$$, :'s23_order_instapay'),
    '42501',
    'Admins only',
    'S24: Customer calling admin_review_payment raises ADM-001'
);

-- 26. Admin at aal1 calling admin_review_payment raises ADM-002 (42501)
SELECT tests.authenticate_as('admin_s23', 'aal1');
SELECT throws_ok(
    format($$SELECT public.admin_review_payment(%s, true)$$, :'s23_order_instapay'),
    '42501',
    'Two-factor authentication required for admin actions',
    'S24: Admin at aal1 calling admin_review_payment raises ADM-002'
);

-- 27. Admin at aal2 rejects payment proof
SELECT tests.authenticate_as('admin_s23', 'aal2');
SELECT lives_ok(
    format($$SELECT public.admin_review_payment(%s, false, 'Blurry receipt image')$$, :'s23_order_instapay'),
    'S24: Admin at aal2 can reject payment'
);

-- 28. Status is now rejected with review note
SELECT is(
    (SELECT (payment_status, payment_review_note) FROM public.orders WHERE id = :'s23_order_instapay'),
    ROW('rejected'::public.payment_status, 'Blurry receipt image'::text),
    'S24: Order payment_status is rejected and review note is saved'
);

-- 29. Payment review event audited
SELECT ok(
    EXISTS (
        SELECT 1 FROM public.audit_log
         WHERE entity = 'orders'
           AND entity_id = :'s23_order_instapay'::text
           AND action = 'PAYMENT_REVIEW'
    ),
    'S24: Payment review action is recorded in audit_log'
);

-- 30. Customer resubmits proof after rejection
SELECT tests.authenticate_as('customer1_s23');
SELECT lives_ok(
    format($$SELECT public.submit_payment_proof(
        %s,
        'REF-12345-RESUBMIT',
        format('%%s/%s/receipt_clear.jpg', tests.get_supabase_uid('customer1_s23'))
    )$$, :'s23_order_instapay', :'s23_order_instapay'),
    'S24: Customer can resubmit proof after rejection'
);

-- 31. Admin at aal2 approves resubmitted proof
SELECT tests.authenticate_as('admin_s23', 'aal2');
SELECT lives_ok(
    format($$SELECT public.admin_review_payment(%s, true, 'Payment confirmed')$$, :'s23_order_instapay'),
    'S24: Admin approves resubmitted proof'
);

-- 32. Order is now paid with paid_at timestamp
SELECT is(
    (SELECT (payment_status, paid_at IS NOT NULL) FROM public.orders WHERE id = :'s23_order_instapay'),
    ROW('paid'::public.payment_status, true),
    'S24: Order is now paid with paid_at timestamp set'
);

-- 33. Customer trying to submit proof again for paid order raises PAY-002 (22023)
SELECT tests.authenticate_as('customer1_s23');
SELECT throws_ok(
    format($$SELECT public.submit_payment_proof(
        %s,
        'REF-ANOTHER',
        format('%%s/%s/extra.jpg', tests.get_supabase_uid('customer1_s23'))
    )$$, :'s23_order_instapay', :'s23_order_instapay'),
    '22023',
    'Order is already paid',
    'S24: Submitting proof for already paid order raises PAY-002'
);

-- ============================================================================
-- 3. Scenario S25: expire_unpaid_orders cancels and restocks overdue orders
-- ============================================================================

-- Create an overdue order by updating payment_deadline into past
SELECT tests.authenticate_as_service_role();
UPDATE public.orders
   SET payment_deadline = now() - interval '1 hour'
 WHERE id = :'s23_order2_instapay';

-- Verify product stock before expiration (was 47 - 1 = 46)
SELECT is(
    (SELECT stock_quantity FROM public.products WHERE id = :'s23_product_id'),
    46,
    'S25: Product stock before order expiration is 46'
);

-- 34. Run expire_unpaid_orders as admin
SELECT tests.authenticate_as('admin_s23', 'aal2');
SELECT cmp_ok(
    public.expire_unpaid_orders(),
    '>=',
    1,
    'S25: expire_unpaid_orders cancels at least 1 overdue order'
);

-- 35. Overdue order is cancelled and product stock restocked back to 47
SELECT is(
    (SELECT (status, (SELECT stock_quantity FROM public.products WHERE id = :'s23_product_id'))
       FROM public.orders WHERE id = :'s23_order2_instapay'),
    ROW('cancelled'::public.order_status, 47),
    'S25: Overdue order status is cancelled and inventory is restocked'
);

-- ============================================================================
-- 4. Storage bucket payment-proofs properties
-- ============================================================================

SELECT tests.authenticate_as_service_role();

-- 36. payment-proofs bucket is private
SELECT is(
    (SELECT public FROM storage.buckets WHERE id = 'payment-proofs'),
    false,
    'S24: payment-proofs bucket is private'
);

-- 37. payment-proofs bucket file_size_limit is 5 MB
SELECT is(
    (SELECT file_size_limit FROM storage.buckets WHERE id = 'payment-proofs'),
    5242880::bigint,
    'S24: payment-proofs bucket file size limit is 5MB'
);

SELECT * FROM finish();
ROLLBACK;

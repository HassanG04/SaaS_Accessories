BEGIN;

SELECT plan(20);

-- ============================================================================
-- Setup for Scenario S18: Stable error codes in hint (T-1.10)
-- ============================================================================

-- Ensure delivery fee exists for governorate 1
INSERT INTO public.delivery_fees (governorate_id, method, fee)
VALUES (1, 'representative', 35.00)
ON CONFLICT (governorate_id, method) DO NOTHING;

-- Helper to inspect hint and detail of raised exceptions
CREATE OR REPLACE FUNCTION tests.assert_error_code(
    p_sql text,
    p_expected_hint text,
    p_expected_detail text DEFAULT NULL,
    p_test_name text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
    v_hint text;
    v_detail text;
    v_errcode text;
    v_msg text;
BEGIN
    BEGIN
        EXECUTE p_sql;
        RETURN ok(false, coalesce(p_test_name, 'Expected exception but statement succeeded'));
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS
            v_hint = PG_EXCEPTION_HINT,
            v_detail = PG_EXCEPTION_DETAIL,
            v_errcode = RETURNED_SQLSTATE,
            v_msg = MESSAGE_TEXT;

        IF v_hint IS DISTINCT FROM p_expected_hint THEN
            RETURN ok(
                false,
                coalesce(p_test_name, 'Hint mismatch') ||
                format(': expected hint %L, got %L (msg: %s)', p_expected_hint, v_hint, v_msg)
            );
        END IF;

        IF p_expected_detail IS NOT NULL AND v_detail IS DISTINCT FROM p_expected_detail THEN
            RETURN ok(
                false,
                coalesce(p_test_name, 'Detail mismatch') ||
                format(': expected detail %L, got %L', p_expected_detail, v_detail)
            );
        END IF;

        RETURN ok(true, coalesce(p_test_name, format('Returns hint %s', p_expected_hint)));
    END;
END;
$$;

-- Create users: buyer and other customer
SELECT tests.create_supabase_user('s18_buyer', 's18_buyer@example.com', '01011112222', '{"full_name": "S18 Buyer"}'::jsonb);
SELECT tests.create_supabase_user('s18_other', 's18_other@example.com', '01033334444', '{"full_name": "S18 Other"}'::jsonb);

-- Retrieve product references
-- Product 1: 'Pearl drop earrings', stock = 12
-- Product 4: 'Layered silver chain', stock = 0
INSERT INTO public.products (category_id, name, name_ar, price, stock_quantity, is_active)
VALUES ((SELECT id FROM public.categories LIMIT 1), 'S18 Inactive Item', 'عنصر غير نشط', 50.00, 10, false)
RETURNING id AS inactive_product_id \gset

-- ----------------------------------------------------------------------------
-- 1. place_order unauthenticated -> AUTH-004
-- ----------------------------------------------------------------------------
SELECT tests.clear_authentication();
-- No subject but a role with EXECUTE: exercise the function's guard separately
-- from the anon ACL denial already covered by S16.
SET LOCAL ROLE authenticated;
SELECT tests.assert_error_code(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', 1, 'quantity', 1)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Anon', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    'AUTH-004',
    NULL,
    'S18.1: place_order without session returns hint AUTH-004'
);

-- Authenticate as customer for remaining place_order tests
SELECT tests.authenticate_as('s18_buyer');

-- ----------------------------------------------------------------------------
-- 2. place_order empty cart -> ORD-001
-- ----------------------------------------------------------------------------
SELECT tests.assert_error_code(
    $$SELECT public.place_order(
    '[]'::jsonb,
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    'ORD-001',
    NULL,
    'S18.2: place_order with empty cart returns hint ORD-001'
);

-- ----------------------------------------------------------------------------
-- 3 & 4. place_order invalid line -> ORD-002
-- ----------------------------------------------------------------------------
SELECT tests.assert_error_code(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('quantity', 1)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    'ORD-002',
    NULL,
    'S18.3: place_order missing product_id returns hint ORD-002'
);

SELECT tests.assert_error_code(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', 1)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    'ORD-002',
    NULL,
    'S18.4: place_order missing quantity returns hint ORD-002'
);

-- ----------------------------------------------------------------------------
-- 5, 6, 7. place_order missing shipping info -> ORD-003
-- ----------------------------------------------------------------------------
SELECT tests.assert_error_code(
    $$SELECT public.place_order(
        jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'), 'quantity', 1)),
        'representative', '   ', '01011112222', 1::smallint, 'City', 'Addr'
    )$$,
    'ORD-003',
    NULL,
    'S18.5: place_order blank name returns hint ORD-003'
);

SELECT tests.assert_error_code(
    $$SELECT public.place_order(
        jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'), 'quantity', 1)),
        'representative', 'Buyer', '', 1::smallint, 'City', 'Addr'
    )$$,
    'ORD-003',
    NULL,
    'S18.6: place_order blank phone returns hint ORD-003'
);

SELECT tests.assert_error_code(
    $$SELECT public.place_order(
        jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'), 'quantity', 1)),
        'representative', 'Buyer', '01011112222', 1::smallint, 'City', '  '
    )$$,
    'ORD-003',
    NULL,
    'S18.7: place_order blank address returns hint ORD-003'
);

-- ----------------------------------------------------------------------------
-- 8. place_order unavailable delivery method -> ORD-004
-- ----------------------------------------------------------------------------
SELECT tests.assert_error_code(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'), 'quantity', 1)),
    'egypt_post', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer', 'phone', '01011112222', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    'ORD-004',
    NULL,
    'S18.8: place_order unavailable delivery method returns hint ORD-004'
);

-- ----------------------------------------------------------------------------
-- 9. place_order inactive product -> ORD-005
-- ----------------------------------------------------------------------------
SELECT tests.assert_error_code(
    format(
        'SELECT public.place_order(
    jsonb_build_array(jsonb_build_object(''product_id'', %s, ''quantity'', 1)),
    ''representative'', ''cod'',
    jsonb_build_object(''postal_code'', ''11511'', ''name'', ''Buyer'', ''phone'', ''010'', ''governorate_id'', 1::smallint, ''city'', ''City'', ''address'', ''Addr'', ''notes'', NULL)
)',
        :'inactive_product_id'
    ),
    'ORD-005',
    NULL,
    'S18.9: place_order inactive product returns hint ORD-005'
);

-- ----------------------------------------------------------------------------
-- 10 & 11. place_order invalid quantity -> ORD-006
-- ----------------------------------------------------------------------------
SELECT tests.assert_error_code(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'), 'quantity', 0)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    'ORD-006',
    NULL,
    'S18.10: place_order quantity 0 returns hint ORD-006'
);

SELECT tests.assert_error_code(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'), 'quantity', -3)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    'ORD-006',
    NULL,
    'S18.11: place_order negative quantity returns hint ORD-006'
);

-- ----------------------------------------------------------------------------
-- 12 & 13. place_order stock insufficient -> ORD-007 (detail = 'left=<n>')
-- ----------------------------------------------------------------------------
SELECT stock_quantity FROM public.products WHERE name = 'Pearl drop earrings' \gset p1_
SELECT tests.assert_error_code(
    format(
        'SELECT public.place_order(
    jsonb_build_array(jsonb_build_object(''product_id'', (SELECT id FROM public.products WHERE name = ''Pearl drop earrings''), ''quantity'', %s)),
    ''representative'', ''cod'',
    jsonb_build_object(''postal_code'', ''11511'', ''name'', ''Buyer'', ''phone'', ''010'', ''governorate_id'', 1::smallint, ''city'', ''City'', ''address'', ''Addr'', ''notes'', NULL)
)',
        :p1_stock_quantity + 2
    ),
    'ORD-007',
    format('left=%s', :p1_stock_quantity),
    'S18.12: place_order oversell returns hint ORD-007 with detail left=N'
);

SELECT tests.assert_error_code(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Layered silver chain'), 'quantity', 1)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    'ORD-007',
    'left=0',
    'S18.13: place_order out of stock returns hint ORD-007 with detail left=0'
);

-- ----------------------------------------------------------------------------
-- 14. place_order product does not exist -> ORD-008
-- ----------------------------------------------------------------------------
SELECT tests.assert_error_code(
    $$SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', 999999, 'quantity', 1)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Buyer', 'phone', '010', 'governorate_id', 1::smallint, 'city', 'City', 'address', 'Addr', 'notes', NULL)
)$$,
    'ORD-008',
    NULL,
    'S18.14: place_order non-existent product returns hint ORD-008'
);

-- ----------------------------------------------------------------------------
-- 15, 16, 17. cancel_my_order -> ORD-009
-- ----------------------------------------------------------------------------
SELECT tests.assert_error_code(
    $$SELECT public.cancel_my_order(999999)$$,
    'ORD-009',
    NULL,
    'S18.15: cancel_my_order non-existent order returns hint ORD-009'
);

-- Create an order for s18_buyer
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Pearl drop earrings'), 'quantity', 1)),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'S18 Buyer', 'phone', '01011112222', 'governorate_id', 1::smallint, 'city', 'Cairo', 'address', 'Maadi', 'notes', NULL)
) AS test_order_id \gset

-- Switch to s18_other and try to cancel s18_buyer's order
SELECT tests.authenticate_as('s18_other');
SELECT tests.assert_error_code(
    format('SELECT public.cancel_my_order(%s)', :'test_order_id'),
    'ORD-009',
    NULL,
    'S18.16: cancel_my_order on another user order returns hint ORD-009'
);

-- Switch back to owner and cancel it once
SELECT tests.authenticate_as('s18_buyer');
SELECT public.cancel_my_order(:'test_order_id');

-- Cancelling a second time (already cancelled) -> ORD-009
SELECT tests.assert_error_code(
    format('SELECT public.cancel_my_order(%s)', :'test_order_id'),
    'ORD-009',
    NULL,
    'S18.17: cancel_my_order on non-pending order returns hint ORD-009'
);

-- ----------------------------------------------------------------------------
-- 18. orders_status_guard -> ORD-014 (reopening a cancelled order)
-- ----------------------------------------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);
SELECT tests.assert_error_code(
    format('UPDATE public.orders SET status = ''pending'' WHERE id = %s', :'test_order_id'),
    'ORD-014',
    NULL,
    'S18.18: orders_status_guard reopening cancelled order returns hint ORD-014'
);

-- ----------------------------------------------------------------------------
-- 19 & 20. admin_dashboard -> ADM-001 (non-admin caller)
-- ----------------------------------------------------------------------------
SELECT tests.authenticate_as('s18_buyer');
SELECT tests.assert_error_code(
    $$SELECT public.admin_dashboard()$$,
    'ADM-001',
    NULL,
    'S18.19: admin_dashboard called by customer returns hint ADM-001'
);

SELECT tests.clear_authentication();
SET LOCAL ROLE authenticated;
SELECT tests.assert_error_code(
    $$SELECT public.admin_dashboard()$$,
    'ADM-001',
    NULL,
    'S18.20: admin_dashboard with no authenticated subject returns hint ADM-001'
);

SELECT * FROM finish();
ROLLBACK;

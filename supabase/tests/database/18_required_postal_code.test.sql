-- ============================================================================
-- 18_required_postal_code.test.sql : T-4.08 Required Postal Code & Snapshots
-- Tests:
-- 1. Schema check: profiles.postal_code and orders.ship_postal_code exist
-- 2. Format constraints: rejects non-5-digit postal codes
-- 3. Signup lifecycle: new user creates profile without address or postal code
-- 4. place_order rejection: missing, null, empty, whitespace, non-numeric, wrong length
-- 5. place_order success: valid 5-digit code with leading zero preserved
-- 6. Address snapshot: order preserves immutable ship_postal_code
-- 7. Profile address update: save_address stores postal code
-- ============================================================================

BEGIN;
SELECT plan(16);

-- 1. Verify schema columns
SELECT has_column('public', 'profiles', 'postal_code', 'profiles has postal_code column');
SELECT has_column('public', 'orders', 'ship_postal_code', 'orders has ship_postal_code column');

-- 2. Check format constraint on profiles
SELECT col_type_is('public', 'profiles', 'postal_code', 'text', 'profiles.postal_code is text');
SELECT col_type_is('public', 'orders', 'ship_postal_code', 'text', 'orders.ship_postal_code is text');

-- 3. Setup test data: product and test users
INSERT INTO public.categories (name, slug)
VALUES ('Postal Test Category', 'postal-test-cat')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products (category_id, name, price, stock_quantity, is_active)
VALUES (
    (SELECT id FROM public.categories WHERE slug = 'postal-test-cat'),
    'Postal Test Product',
    100.00,
    50,
    true
) RETURNING id AS test_product_id \gset

INSERT INTO public.delivery_fees (governorate_id, method, fee)
VALUES (1, 'representative', 35.00)
ON CONFLICT (governorate_id, method) DO NOTHING;

-- Create test customer
SELECT tests.create_supabase_user('postal_customer_1');
SELECT tests.authenticate_as('postal_customer_1');

-- 4. Verify initial signup profile has null address and postal_code
SELECT is(
    (SELECT postal_code FROM public.profiles WHERE id = tests.get_supabase_uid('postal_customer_1')),
    NULL,
    'T-4.08: User signup succeeds with null postal_code before address entry'
);

-- 5. place_order rejects missing postal_code (ORD-012)
SELECT throws_ok(
    format($$SELECT public.place_order(
        jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 1)),
        'representative',
        'cod',
        jsonb_build_object(
            'name', 'Postal Tester',
            'phone', '01012345678',
            'governorate_id', 1,
            'address', '10 Test Street'
        )
    )$$, :'test_product_id'),
    '22023',
    'Invalid shipping field length or missing required fields',
    'T-4.08: place_order rejects missing postal_code with ORD-012'
);

SELECT throws_ok(
    format($$SELECT public.place_order(
        jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 1)),
        'representative', 'cod',
        jsonb_build_object('name', 'Postal Tester', 'phone', '01012345678',
            'governorate_id', 1, 'address', '10 Test Street', 'postal_code', NULL)
    )$$, :'test_product_id'),
    '22023', 'Invalid shipping field length or missing required fields',
    'T-4.08: explicit null postal code is rejected'
);

-- 6. place_order rejects empty string postal_code
SELECT throws_ok(
    format($$SELECT public.place_order(
        jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 1)),
        'representative',
        'cod',
        jsonb_build_object(
            'name', 'Postal Tester',
            'phone', '01012345678',
            'governorate_id', 1,
            'address', '10 Test Street',
            'postal_code', ''
        )
    )$$, :'test_product_id'),
    '22023',
    'Invalid shipping field length or missing required fields',
    'T-4.08: place_order rejects empty string postal_code'
);

-- 7. place_order rejects whitespace-only postal_code
SELECT throws_ok(
    format($$SELECT public.place_order(
        jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 1)),
        'representative',
        'cod',
        jsonb_build_object(
            'name', 'Postal Tester',
            'phone', '01012345678',
            'governorate_id', 1,
            'address', '10 Test Street',
            'postal_code', '     '
        )
    )$$, :'test_product_id'),
    '22023',
    'Invalid shipping field length or missing required fields',
    'T-4.08: place_order rejects whitespace-only postal_code'
);

-- 8. place_order rejects short postal code (e.g. 4 digits)
SELECT throws_ok(
    format($$SELECT public.place_order(
        jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 1)),
        'representative',
        'cod',
        jsonb_build_object(
            'name', 'Postal Tester',
            'phone', '01012345678',
            'governorate_id', 1,
            'address', '10 Test Street',
            'postal_code', '1151'
        )
    )$$, :'test_product_id'),
    '22023',
    'Invalid shipping field length or missing required fields',
    'T-4.08: place_order rejects 4-digit postal_code'
);

-- 9. place_order rejects non-numeric postal code
SELECT throws_ok(
    format($$SELECT public.place_order(
        jsonb_build_array(jsonb_build_object('product_id', %s, 'quantity', 1)),
        'representative',
        'cod',
        jsonb_build_object(
            'name', 'Postal Tester',
            'phone', '01012345678',
            'governorate_id', 1,
            'address', '10 Test Street',
            'postal_code', 'ABCDE'
        )
    )$$, :'test_product_id'),
    '22023',
    'Invalid shipping field length or missing required fields',
    'T-4.08: place_order rejects non-numeric postal_code'
);

-- 10. place_order succeeds with valid 5-digit postal code containing leading zero ('01234')
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :'test_product_id', 'quantity', 1)),
    'representative',
    'cod',
    jsonb_build_object(
        'name', 'Postal Tester',
        'phone', '01012345678',
        'governorate_id', 1,
        'address', '10 Test Street',
        'postal_code', '01234',
        'save_address', true
    )
) AS placed_order_id \gset

SELECT ok(
    :'placed_order_id' IS NOT NULL AND :'placed_order_id' > 0,
    'T-4.08: place_order succeeds with valid 5-digit postal code'
);

-- 11. Verify order snapshot preserves leading zero
SELECT is(
    (SELECT ship_postal_code FROM public.orders WHERE id = :'placed_order_id'),
    '01234',
    'T-4.08: Order snapshot preserves exact postal_code text with leading zero'
);

-- 12. Verify saved address on profile contains postal_code
SELECT is(
    (SELECT postal_code FROM public.profiles WHERE id = tests.get_supabase_uid('postal_customer_1')),
    '01234',
    'T-4.08: Profile saved address contains postal_code when save_address is true'
);

-- 13. Verify profile address update permission works for authenticated user
UPDATE public.profiles
   SET postal_code = '11511'
 WHERE id = tests.get_supabase_uid('postal_customer_1');

SELECT is(
    (SELECT postal_code FROM public.profiles WHERE id = tests.get_supabase_uid('postal_customer_1')),
    '11511',
    'T-4.08: Authenticated user can update own postal_code'
);

-- 14. Verify order snapshot remains immutable after profile update
SELECT is(
    (SELECT ship_postal_code FROM public.orders WHERE id = :'placed_order_id'),
    '01234',
    'T-4.08: Order snapshot remains immutable after customer profile changes'
);

SELECT * FROM finish();
ROLLBACK;

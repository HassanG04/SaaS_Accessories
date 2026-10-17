BEGIN;

SELECT plan(31);

-- ============================================================================
-- Setup for T-1.19 Catalog Admin Support (Scenario S26)
-- ============================================================================

SELECT tests.create_supabase_user(
    'admin_s26',
    'admin_s26@example.com',
    '01011110026',
    '{"full_name": "Admin S26"}'::jsonb
);

SELECT tests.create_supabase_user(
    'customer_s26',
    'customer_s26@example.com',
    '01022220026',
    '{"full_name": "Customer S26"}'::jsonb
);

-- Promote admin_s26 to admin as database owner
UPDATE public.profiles
   SET role = 'admin'
 WHERE id = tests.get_supabase_uid('admin_s26');

-- Ensure delivery fee exists for governorate 1
INSERT INTO public.delivery_fees (governorate_id, method, fee)
VALUES (1, 'representative', 35.00)
ON CONFLICT (governorate_id, method) DO NOTHING;

-- Create test categories
INSERT INTO public.categories (name, name_ar, slug, sort_order)
VALUES ('Cat A S26', 'قسم أ', 'cat-a-s26', 1)
RETURNING id AS s26_cat_a \gset

INSERT INTO public.categories (name, name_ar, slug, sort_order)
VALUES ('Cat B S26', 'قسم ب', 'cat-b-s26', 2)
RETURNING id AS s26_cat_b \gset

-- Create test products in Cat A
INSERT INTO public.products (
    category_id, name, name_ar, price, stock_quantity, is_active
) VALUES (
    :s26_cat_a,
    'S26 Ordered Product',
    'منتج مطلوب',
    100.00,
    10,
    true
) RETURNING id AS s26_prod_ordered \gset

INSERT INTO public.products (
    category_id, name, name_ar, price, stock_quantity, is_active
) VALUES (
    :s26_cat_a,
    'S26 Never Ordered Product',
    'منتج غير مطلوب',
    150.00,
    0,
    true
) RETURNING id AS s26_prod_never_ordered \gset

-- Customer places order containing s26_prod_ordered
SELECT tests.authenticate_as('customer_s26');
SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :s26_prod_ordered, 'quantity', 1)),
    'representative',
    'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Cust S26', 'phone', '01022220026', 'governorate_id', 1, 'address', 'Address S26')
);

-- ============================================================================
-- 1. Category and Product flags
-- ============================================================================

-- 1. Category is_active defaults to true
SELECT is(
    (SELECT is_active FROM public.categories WHERE id = :s26_cat_a),
    true,
    'S26: categories.is_active defaults to true'
);

-- 2. Category show_on_home defaults to false
SELECT is(
    (SELECT show_on_home FROM public.categories WHERE id = :s26_cat_a),
    false,
    'S26: categories.show_on_home defaults to false'
);

-- 3. Product is_featured defaults to false
SELECT is(
    (SELECT is_featured FROM public.products WHERE id = :s26_prod_ordered),
    false,
    'S26: products.is_featured defaults to false'
);

-- ============================================================================
-- 2. Image path pattern validation
-- ============================================================================

SELECT tests.authenticate_as('admin_s26', 'aal2');

-- 4. Full URL in categories.image_url is rejected (23514)
SELECT throws_ok(
    format($$UPDATE public.categories SET image_url = 'https://example.com/pic.jpg' WHERE id = %s$$, :s26_cat_a),
    '23514',
    NULL,
    'S26: Full URL in categories.image_url rejected by check constraint'
);

-- 5. Bad folder prefix in categories.image_url is rejected (23514)
SELECT throws_ok(
    format($$UPDATE public.categories SET image_url = 'random_folder/pic.png' WHERE id = %s$$, :s26_cat_a),
    '23514',
    NULL,
    'S26: Bad folder prefix in categories.image_url rejected'
);

-- 6. Valid storage path in categories.image_url succeeds
SELECT lives_ok(
    format($$UPDATE public.categories SET image_url = 'categories/banner_test.webp' WHERE id = %s$$, :s26_cat_a),
    'S26: Valid storage path in categories.image_url succeeds'
);

-- 7. Full URL in products.image_url is rejected (23514)
SELECT throws_ok(
    format($$UPDATE public.products SET image_url = 'https://example.com/ring.png' WHERE id = %s$$, :s26_prod_ordered),
    '23514',
    NULL,
    'S26: Full URL in products.image_url rejected'
);

-- 8. Valid storage path in products.image_url succeeds
SELECT lives_ok(
    format($$UPDATE public.products SET image_url = 'products/ring_gold.jpg' WHERE id = %s$$, :s26_prod_ordered),
    'S26: Valid storage path in products.image_url succeeds'
);

-- 9. Bad path in products.extra_images array is rejected (23514)
SELECT throws_ok(
    format($$UPDATE public.products SET extra_images = ARRAY['products/p1.webp', 'https://bad.com/p2.jpg'] WHERE id = %s$$, :s26_prod_ordered),
    '23514',
    NULL,
    'S26: Non-matching path in products.extra_images rejected'
);

-- 10. Valid paths in products.extra_images array succeed
SELECT lives_ok(
    format($$UPDATE public.products SET extra_images = ARRAY['products/p1.webp', 'products/sub/p2_alt.png'] WHERE id = %s$$, :s26_prod_ordered),
    'S26: Valid paths in products.extra_images succeed'
);

-- ============================================================================
-- 3. Storefront active policies
-- ============================================================================

-- Make Cat A inactive
SELECT tests.authenticate_as('admin_s26', 'aal2');
UPDATE public.categories SET is_active = false WHERE id = :s26_cat_a;

-- 11. Anonymous visitor cannot see inactive category
SELECT tests.clear_authentication();
SELECT is(
    (SELECT count(*)::bigint FROM public.categories WHERE id = :s26_cat_a),
    0::bigint,
    'S26: Visitor cannot see inactive category'
);

-- 12. Anonymous visitor cannot see products under inactive category
SELECT is(
    (SELECT count(*)::bigint FROM public.products WHERE category_id = :s26_cat_a),
    0::bigint,
    'S26: Visitor cannot see products belonging to inactive category'
);

-- 13. Admin at aal2 CAN see inactive category
SELECT tests.authenticate_as('admin_s26', 'aal2');
SELECT is(
    (SELECT count(*)::bigint FROM public.categories WHERE id = :s26_cat_a),
    1::bigint,
    'S26: Admin at aal2 can see inactive category'
);

-- 14. Admin at aal2 CAN see products under inactive category
SELECT is(
    (SELECT count(*)::bigint FROM public.products WHERE category_id = :s26_cat_a),
    2::bigint,
    'S26: Admin at aal2 can see products of inactive category'
);

-- Restore Cat A is_active
UPDATE public.categories SET is_active = true WHERE id = :s26_cat_a;

-- ============================================================================
-- 4. admin_delete_product
-- ============================================================================

-- 15. Customer calling admin_delete_product raises ADM-001 (42501)
SELECT tests.authenticate_as('customer_s26');
SELECT throws_ok(
    format($$SELECT public.admin_delete_product(%s)$$, :s26_prod_never_ordered),
    '42501',
    'Admins only',
    'S26: Customer calling admin_delete_product raises ADM-001'
);

-- 16. Admin at aal1 calling admin_delete_product raises ADM-002 (42501)
SELECT tests.authenticate_as('admin_s26', 'aal1');
SELECT throws_ok(
    format($$SELECT public.admin_delete_product(%s)$$, :s26_prod_never_ordered),
    '42501',
    'Two-factor authentication required for admin actions',
    'S26: Admin at aal1 calling admin_delete_product raises ADM-002'
);

-- 17. Admin at aal2 deleting ordered product raises ADM-004 (22023)
SELECT tests.authenticate_as('admin_s26', 'aal2');
SELECT throws_ok(
    format($$SELECT public.admin_delete_product(%s)$$, :s26_prod_ordered),
    '22023',
    'Cannot delete ordered product',
    'S26: Deleting ordered product raises ADM-004'
);

-- 18. Admin at aal2 deleting never-ordered product succeeds
SELECT lives_ok(
    format($$SELECT public.admin_delete_product(%s)$$, :s26_prod_never_ordered),
    'S26: Deleting never-ordered product succeeds'
);

-- 19. Never-ordered product is gone from table
SELECT is(
    (SELECT count(*)::bigint FROM public.products WHERE id = :s26_prod_never_ordered),
    0::bigint,
    'S26: Deleted product removed from products table'
);

-- 20. Product deletion is recorded in audit_log
SELECT ok(
    EXISTS (
        SELECT 1 FROM public.audit_log
         WHERE entity = 'products'
           AND entity_id = :s26_prod_never_ordered::text
           AND action = 'DELETE'
    ),
    'S26: Product deletion is recorded in audit_log'
);

-- ============================================================================
-- 5. admin_delete_category
-- ============================================================================

-- 21. Customer calling admin_delete_category raises ADM-001 (42501)
SELECT tests.authenticate_as('customer_s26');
SELECT throws_ok(
    format($$SELECT public.admin_delete_category(%s)$$, :s26_cat_a),
    '42501',
    'Admins only',
    'S26: Customer calling admin_delete_category raises ADM-001'
);

-- 22. Admin at aal1 calling admin_delete_category raises ADM-002 (42501)
SELECT tests.authenticate_as('admin_s26', 'aal1');
SELECT throws_ok(
    format($$SELECT public.admin_delete_category(%s)$$, :s26_cat_a),
    '42501',
    'Two-factor authentication required for admin actions',
    'S26: Admin at aal1 calling admin_delete_category raises ADM-002'
);

-- 23. Deleting non-empty category without target raises ADM-005 (22023)
SELECT tests.authenticate_as('admin_s26', 'aal2');
SELECT throws_ok(
    format($$SELECT public.admin_delete_category(%s)$$, :s26_cat_a),
    '22023',
    'Cannot delete non-empty category without target',
    'S26: Deleting non-empty category without move target raises ADM-005'
);

-- 24. Deleting non-empty category with target = self raises ADM-005 (22023)
SELECT throws_ok(
    format($$SELECT public.admin_delete_category(%s, %s)$$, :s26_cat_a, :s26_cat_a),
    '22023',
    'Target category cannot be the same as deleted category',
    'S26: Deleting category with self as target raises ADM-005'
);

-- 25. Deleting non-empty category with nonexistent target raises ADM-005 (22023)
SELECT throws_ok(
    format($$SELECT public.admin_delete_category(%s, 999999)$$, :s26_cat_a),
    '22023',
    'Target category does not exist',
    'S26: Deleting category with nonexistent target raises ADM-005'
);

-- 26. Deleting non-empty category with valid move target succeeds
SELECT lives_ok(
    format($$SELECT public.admin_delete_category(%s, %s)$$, :s26_cat_a, :s26_cat_b),
    'S26: Deleting category and moving products to Cat B succeeds'
);

-- 27. Products in deleted category were moved to target category (Cat B)
SELECT is(
    (SELECT category_id FROM public.products WHERE id = :s26_prod_ordered),
    :s26_cat_b::bigint,
    'S26: Products moved to target category'
);

-- 28. Deleted category is gone from categories table
SELECT is(
    (SELECT count(*)::bigint FROM public.categories WHERE id = :s26_cat_a),
    0::bigint,
    'S26: Deleted category removed from categories table'
);

-- 29. Category deletion is recorded in audit_log
SELECT ok(
    EXISTS (
        SELECT 1 FROM public.audit_log
         WHERE entity = 'categories'
           AND entity_id = :s26_cat_a::text
           AND action = 'DELETE'
    ),
    'S26: Category deletion is recorded in audit_log'
);

-- 30. Deleting an empty category with NULL move target succeeds
INSERT INTO public.categories (name, name_ar, slug, sort_order)
VALUES ('Empty Cat S26', 'قسم فارغ', 'empty-cat-s26', 3)
RETURNING id AS s26_empty_cat \gset

SELECT lives_ok(
    format($$SELECT public.admin_delete_category(%s, NULL)$$, :s26_empty_cat),
    'S26: Deleting empty category with NULL target succeeds'
);

-- 31. Empty category is gone
SELECT is(
    (SELECT count(*)::bigint FROM public.categories WHERE id = :s26_empty_cat),
    0::bigint,
    'S26: Empty category removed from table'
);

SELECT * FROM finish();
ROLLBACK;

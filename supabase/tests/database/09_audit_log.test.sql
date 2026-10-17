BEGIN;

SELECT plan(17);

-- ============================================================================
-- Setup for T-1.16 Audit Log (Scenario S21)
-- ============================================================================

INSERT INTO public.delivery_fees (governorate_id, method, fee)
VALUES (1, 'representative', 35.00)
ON CONFLICT (governorate_id, method) DO NOTHING;

SELECT tests.create_supabase_user(
    'admin_s21',
    'admin_s21@example.com',
    '01011110021',
    '{"full_name": "Admin S21"}'::jsonb
);

SELECT tests.create_supabase_user(
    'customer_s21',
    'customer_s21@example.com',
    '01022220021',
    '{"full_name": "Customer S21"}'::jsonb
);

SELECT tests.create_supabase_user(
    'target_s21',
    'target_s21@example.com',
    '01033330021',
    '{"full_name": "Target User S21"}'::jsonb
);

-- Promote admin_s21 to admin as database owner
UPDATE public.profiles
   SET role = 'admin'
 WHERE id = tests.get_supabase_uid('admin_s21');

-- Clear any audit log rows generated during earlier test fixtures/seeds
-- Note: direct truncate/delete will test immutability below, so we test immutability on a test row.

-- ============================================================================
-- 1. Immutability: UPDATE and DELETE on audit_log fail even for database owner
-- ============================================================================

-- Insert a test audit log row via audit_event()
SELECT lives_ok(
    $$SELECT public.audit_event('SYSTEM_TEST', 'system', 'test-1', '{"state": "init"}'::jsonb, '{"state": "done"}'::jsonb)$$,
    'S21: Can append to audit_log via audit_event()'
);

-- Attempting UPDATE on audit_log fails (blocked by trigger with 42501)
SELECT throws_ok(
    $$UPDATE public.audit_log SET action = 'TAMPERED' WHERE entity = 'system'$$,
    '42501',
    'audit_log is append-only; update and delete are prohibited',
    'S21: UPDATE on audit_log fails even for database owner'
);

-- Attempting DELETE on audit_log fails (blocked by trigger with 42501)
SELECT throws_ok(
    $$DELETE FROM public.audit_log WHERE entity = 'system'$$,
    '42501',
    'audit_log is append-only; update and delete are prohibited',
    'S21: DELETE on audit_log fails even for database owner'
);

-- ============================================================================
-- 2. Visibility / RLS: unreadable by customers and admin at aal1; readable at aal2
-- ============================================================================

-- Customer sees 0 rows in audit_log
SELECT tests.authenticate_as('customer_s21');
SELECT is(
    (SELECT count(*)::bigint FROM public.audit_log),
    0::bigint,
    'S21: Customer reads 0 rows from audit_log'
);

-- Admin at aal1 sees 0 rows in audit_log
SELECT tests.authenticate_as('admin_s21', 'aal1');
SELECT is(
    (SELECT count(*)::bigint FROM public.audit_log),
    0::bigint,
    'S21: Admin at aal1 reads 0 rows from audit_log'
);

-- Admin at aal2 CAN read rows from audit_log
SELECT tests.authenticate_as('admin_s21', 'aal2');
SELECT cmp_ok(
    (SELECT count(*)::bigint FROM public.audit_log),
    '>',
    0::bigint,
    'S21: Admin at aal2 reads rows from audit_log'
);

-- ============================================================================
-- 3. Stock changes made by place_order do NOT appear in audit_log
-- ============================================================================

-- Customer places order (which updates products.stock_quantity)
SELECT tests.authenticate_as('customer_s21');

SELECT lives_ok(
    format($$SELECT public.place_order(
    jsonb_build_array(
            jsonb_build_object(
                'product_id', (SELECT id FROM public.products WHERE is_active LIMIT 1),
                'quantity', 1
            )
        ),
    'representative', 'cod',
    jsonb_build_object('postal_code', '11511', 'name', 'Customer S21', 'phone', '01022220021', 'governorate_id', 1::smallint, 'city', 'Cairo', 'address', 'Audit Test St', 'notes', NULL)
)$$),
    'S21: Customer places order successfully'
);

-- Switch back to admin at aal2 to check audit_log
SELECT tests.authenticate_as('admin_s21', 'aal2');

SELECT is(
    (SELECT count(*)::bigint FROM public.audit_log
      WHERE actor = tests.get_supabase_uid('customer_s21')
        AND entity = 'products'),
    0::bigint,
    'S21: Stock change made by customer place_order is NOT in audit_log'
);

-- ============================================================================
-- 4. Admin changes appear with actor, role and old/new values
-- ============================================================================

-- Admin creates a new category
INSERT INTO public.categories (name, name_ar, slug, sort_order)
VALUES ('Audit Category', 'قسم المراجعة', 'audit-category', 99);

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.audit_log
         WHERE entity = 'categories'
           AND action = 'INSERT'
           AND (new ->> 'slug') = 'audit-category'
    ),
    'S21: Admin category INSERT appears in audit_log'
);

SELECT is(
    (SELECT actor_role FROM public.audit_log
      WHERE entity = 'categories'
        AND action = 'INSERT'
        AND (new ->> 'slug') = 'audit-category'
      LIMIT 1),
    'admin',
    'S21: Admin category audit row has actor_role = admin'
);

-- Admin updates product price
UPDATE public.products
   SET price = 199.00
 WHERE name = 'Pearl drop earrings';

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.audit_log
         WHERE entity = 'products'
           AND action = 'UPDATE'
           AND actor = tests.get_supabase_uid('admin_s21')
           AND (new ->> 'name') = 'Pearl drop earrings'
    ),
    'S21: Admin product price UPDATE appears in audit_log'
);

SELECT is(
    (SELECT (new ->> 'price')::numeric FROM public.audit_log
      WHERE entity = 'products'
        AND action = 'UPDATE'
        AND actor = tests.get_supabase_uid('admin_s21')
        AND (new ->> 'name') = 'Pearl drop earrings'
      ORDER BY id DESC LIMIT 1),
    199.00,
    'S21: Product audit row contains new price value'
);

-- Admin updates order status
UPDATE public.orders
   SET status = 'confirmed'
 WHERE ship_name = 'Customer S21';

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.audit_log
         WHERE entity = 'orders'
           AND action = 'UPDATE'
           AND actor = tests.get_supabase_uid('admin_s21')
           AND (new ->> 'status') = 'confirmed'
    ),
    'S21: Admin order status UPDATE appears in audit_log'
);

SELECT is(
    (SELECT (old ->> 'status') FROM public.audit_log
      WHERE entity = 'orders'
        AND action = 'UPDATE'
        AND actor = tests.get_supabase_uid('admin_s21')
        AND (new ->> 'status') = 'confirmed'
      ORDER BY id DESC LIMIT 1),
    'pending',
    'S21: Order audit row contains old status = pending'
);

-- Admin calls audit_event helper
SELECT throws_ok(
    $$SELECT public.audit_event('MANUAL_REVIEW', 'orders', '999', '{"reviewed": false}'::jsonb, '{"reviewed": true}'::jsonb)$$,
    '42501',
    NULL,
    'S21: Admin cannot forge audit events through the API'
);

-- ============================================================================
-- 5. Owner changes appear in audit_log
-- ============================================================================

-- Switch to database owner (postgres) and promote target_s21
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

UPDATE public.profiles
   SET role = 'admin'
 WHERE id = tests.get_supabase_uid('target_s21');

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.audit_log
         WHERE entity = 'profiles'
           AND action = 'UPDATE'
           AND entity_id = tests.get_supabase_uid('target_s21')::text
           AND (new ->> 'role') = 'admin'
    ),
    'S21: Owner profile role UPDATE appears in audit_log'
);

SELECT is(
    (SELECT (old ->> 'role') FROM public.audit_log
      WHERE entity = 'profiles'
        AND action = 'UPDATE'
        AND entity_id = tests.get_supabase_uid('target_s21')::text
      ORDER BY id DESC LIMIT 1),
    'customer',
    'S21: Profile audit row contains old role = customer'
);

SELECT * FROM finish();
ROLLBACK;

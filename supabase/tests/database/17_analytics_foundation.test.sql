BEGIN;

SELECT plan(54);

-- ============================================================================
-- Scenario S31: Analytics database foundation & role boundary enforcement
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Part 1: Schema, Tables, Views and Roles existence
-- ----------------------------------------------------------------------------

SELECT has_schema('analytics', 'Schema analytics exists');

SELECT has_table('analytics', 'calendar', 'analytics.calendar table exists');
SELECT has_table('analytics', 'forecast_runs', 'analytics.forecast_runs table exists');
SELECT has_table('analytics', 'sales_forecasts', 'analytics.sales_forecasts table exists');
SELECT has_table('analytics', 'forecast_metrics', 'analytics.forecast_metrics table exists');
SELECT has_table('analytics', 'basket_pairs', 'analytics.basket_pairs table exists');
SELECT has_table('analytics', 'cohort_retention', 'analytics.cohort_retention table exists');
SELECT has_table('analytics', 'customer_segments', 'analytics.customer_segments table exists');

SELECT has_view('analytics', 'sales_daily', 'analytics.sales_daily view exists');
SELECT has_view('analytics', 'stock_daily', 'analytics.stock_daily view exists');
SELECT has_view('analytics', 'forecast_accuracy', 'analytics.forecast_accuracy view exists');
SELECT has_view('analytics', 'sales_overview', 'analytics.sales_overview view exists');
SELECT has_view('analytics', 'product_performance', 'analytics.product_performance view exists');
SELECT has_view('analytics', 'discount_effect', 'analytics.discount_effect view exists');
SELECT has_view('analytics', 'fulfilment_quality', 'analytics.fulfilment_quality view exists');
SELECT has_view('analytics', 'geography', 'analytics.geography view exists');

SELECT ok(
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analytics_reader'),
    'Role analytics_reader exists'
);

SELECT ok(
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analytics_writer'),
    'Role analytics_writer exists'
);

-- ----------------------------------------------------------------------------
-- Part 2: Seed & Test Data Setup
-- ----------------------------------------------------------------------------

SELECT tests.create_supabase_user(
    'analytics_admin_user',
    'analytics_admin@example.com',
    '01099998888',
    '{"full_name": "Analytics Admin"}'::jsonb
);

SELECT tests.create_supabase_user(
    'analytics_customer_user',
    'analytics_cust@example.com',
    '01088887777',
    '{"full_name": "Analytics Customer"}'::jsonb
);

-- Promote admin
UPDATE public.profiles
   SET role = 'admin'
 WHERE id = tests.get_supabase_uid('analytics_admin_user');

-- Create test category and product
INSERT INTO public.categories (name, name_ar, slug, is_active)
VALUES ('Analytics Test Cat', 'تصنيف تحليلات', 'analytics-test-cat', true)
RETURNING id AS cat_id \gset

INSERT INTO public.products (
    category_id, name, name_ar, price, stock_quantity, is_active
) VALUES (
    :cat_id,
    'Analytics Test Item',
    'منتج تحليلات',
    100.00,
    50,
    true
) RETURNING id AS prod_id \gset

-- Delivery fee
INSERT INTO public.delivery_fees (governorate_id, method, fee)
VALUES (1, 'representative', 30.00)
ON CONFLICT (governorate_id, method) DO NOTHING;

-- Place an order as customer
SELECT tests.authenticate_as('analytics_customer_user', 'aal1');

SELECT public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', :prod_id, 'quantity', 3)),
    'representative'::public.delivery_method,
    'cod'::public.payment_method,
    jsonb_build_object('postal_code', '11511',
        'name', 'Analytics Customer',
        'phone', '01088887777',
        'governorate_id', 1,
        'city', 'القاهرة',
        'address', '10 شارع النصر'
    )
) AS test_order_id \gset

-- Admin confirms the COD order so it counts as confirmed sale
SELECT tests.authenticate_as('analytics_admin_user', 'aal2');
UPDATE public.orders
   SET status = 'confirmed'
 WHERE id = :test_order_id;

-- Reset to postgres for checking aggregates
SELECT set_config('role', 'postgres', true);

-- ----------------------------------------------------------------------------
-- Part 3: Aggregate Views and Calendar verification
-- ----------------------------------------------------------------------------

-- Check analytics.calendar
SELECT ok(
    (SELECT count(*) FROM analytics.calendar WHERE day = '2026-03-21' AND mothers_day = true) = 1,
    'Calendar has Mother''s Day marked on 2026-03-21'
);

SELECT ok(
    (SELECT count(*) FROM analytics.calendar WHERE day = '2026-02-20' AND ramadan = true) = 1,
    'Calendar has Ramadan marked on 2026-02-20'
);

-- Check analytics.sales_daily aggregations
SELECT is(
    (SELECT units FROM analytics.sales_daily WHERE product_id = :prod_id LIMIT 1),
    3,
    'sales_daily correctly summed 3 units'
);

SELECT is(
    (SELECT revenue FROM analytics.sales_daily WHERE product_id = :prod_id LIMIT 1),
    300.00::numeric(12,2),
    'sales_daily correctly summed 300.00 EGP revenue'
);

SELECT is(
    (SELECT orders FROM analytics.sales_daily WHERE product_id = :prod_id LIMIT 1),
    1,
    'sales_daily correctly counted 1 order'
);

-- Check analytics.stock_daily
SELECT ok(
    (SELECT closing_stock FROM analytics.stock_daily WHERE product_id = :prod_id LIMIT 1) = 47,
    'stock_daily correctly captured closing stock 47 after order placement'
);

-- ----------------------------------------------------------------------------
-- Part 4: Role Boundary Enforcement (Scenario S31)
-- ----------------------------------------------------------------------------

-- 4.1: analytics_reader role tests
SELECT lives_ok(
    'DO $$ BEGIN SET LOCAL ROLE analytics_reader; PERFORM * FROM analytics.sales_daily; RESET ROLE; END $$;',
    'S31: analytics_reader can select from analytics.sales_daily'
);

SELECT lives_ok(
    'DO $$ BEGIN SET LOCAL ROLE analytics_reader; PERFORM * FROM analytics.calendar; RESET ROLE; END $$;',
    'S31: analytics_reader can select from analytics.calendar'
);

-- Prohibited public table access for analytics_reader (Zero PII guarantee)
SELECT throws_ok(
    'DO $$ BEGIN SET LOCAL ROLE analytics_reader; PERFORM * FROM public.orders; END $$;',
    '42501',
    NULL,
    'S31: analytics_reader cannot read public.orders (permission denied)'
);

SELECT throws_ok(
    'DO $$ BEGIN SET LOCAL ROLE analytics_reader; PERFORM * FROM public.profiles; END $$;',
    '42501',
    NULL,
    'S31: analytics_reader cannot read public.profiles (permission denied)'
);

SELECT throws_ok(
    'DO $$ BEGIN SET LOCAL ROLE analytics_reader; PERFORM * FROM public.order_items; END $$;',
    '42501',
    NULL,
    'S31: analytics_reader cannot read public.order_items (permission denied)'
);

-- Prohibited writes for analytics_reader
SELECT throws_ok(
    'DO $$ BEGIN SET LOCAL ROLE analytics_reader; INSERT INTO analytics.forecast_runs (git_commit, input_hash) VALUES (''test'', ''hash''); END $$;',
    '42501',
    NULL,
    'S31: analytics_reader cannot insert into analytics.forecast_runs (permission denied)'
);

-- 4.2: analytics_writer role tests
SELECT throws_ok(
    'DO $$ BEGIN SET LOCAL ROLE analytics_writer; PERFORM * FROM public.orders; END $$;',
    '42501',
    NULL,
    'S31: analytics_writer cannot read public.orders (permission denied)'
);

SELECT throws_ok(
    'DO $$ BEGIN SET LOCAL ROLE analytics_writer; PERFORM * FROM public.profiles; END $$;',
    '42501',
    NULL,
    'S31: analytics_writer cannot read public.profiles (permission denied)'
);

-- Allowed writes for analytics_writer
SELECT lives_ok(
    'DO $$ BEGIN SET LOCAL ROLE analytics_writer; INSERT INTO analytics.forecast_runs (git_commit, input_hash) VALUES (''c0ffee1'', ''hash123''); RESET ROLE; END $$;',
    'S31: analytics_writer can insert into analytics.forecast_runs'
);

-- ----------------------------------------------------------------------------
-- Part 5: Public API Isolation & Admin-only Functions
-- ----------------------------------------------------------------------------

-- 5.1: Anonymous visitor access checks
SELECT tests.clear_authentication();

SELECT throws_ok(
    $$ SELECT * FROM analytics.sales_daily $$,
    '42501',
    NULL,
    'Anon cannot read analytics.sales_daily'
);

SELECT throws_ok(
    $$ SELECT * FROM analytics.calendar $$,
    '42501',
    NULL,
    'Anon cannot read analytics.calendar'
);

SELECT throws_ok(
    $$ SELECT public.admin_get_forecasts() $$,
    '42501',
    NULL,
    'Anon cannot execute admin_get_forecasts'
);

-- 5.2: Authenticated customer access checks
SELECT tests.authenticate_as('analytics_customer_user', 'aal1');

SELECT throws_ok(
    $$ SELECT * FROM analytics.sales_daily $$,
    '42501',
    NULL,
    'Customer cannot read analytics.sales_daily'
);

SELECT throws_ok(
    $$ SELECT public.admin_get_forecasts() $$,
    '42501',
    'Admins only',
    'Customer calling admin_get_forecasts throws ADM-001'
);

SELECT throws_ok(
    $$ SELECT public.admin_get_reorder_list() $$,
    '42501',
    'Admins only',
    'Customer calling admin_get_reorder_list throws ADM-001'
);

SELECT throws_ok(
    $$ SELECT public.admin_get_analytics_insights() $$,
    '42501',
    'Admins only',
    'Customer calling admin_get_analytics_insights throws ADM-001'
);

-- 5.3: Admin at AAL1 (MFA required)
SELECT tests.authenticate_as('analytics_admin_user', 'aal1');

SELECT throws_ok(
    $$ SELECT public.admin_get_forecasts() $$,
    '42501',
    'Two-factor authentication required for admin actions',
    'Admin at AAL1 calling admin_get_forecasts throws ADM-002'
);

SELECT throws_ok(
    $$ SELECT public.admin_get_analytics_insights() $$,
    '42501',
    'Two-factor authentication required for admin actions',
    'Admin at AAL1 calling admin_get_analytics_insights throws ADM-002'
);

-- 5.4: Admin at AAL2 (Success)
SELECT tests.authenticate_as('analytics_admin_user', 'aal2');

SELECT ok(
    (SELECT (public.admin_get_forecasts())->>'status') = 'ok',
    'Admin at AAL2 can successfully call admin_get_forecasts'
);

SELECT ok(
    (public.admin_get_forecasts() ? 'history'),
    'admin_get_forecasts result includes history array'
);

SELECT ok(
    jsonb_array_length(public.admin_get_reorder_list()) >= 1,
    'Admin at AAL2 can successfully call admin_get_reorder_list'
);

SELECT ok(
    ((public.admin_get_reorder_list()->0) ? 'days_since_last_sale') AND ((public.admin_get_reorder_list()->0) ? 'is_dead_stock'),
    'admin_get_reorder_list items include dead stock and days since last sale fields'
);

SELECT ok(
    (public.admin_get_analytics_insights() ? 'basket_pairs'),
    'Admin at AAL2 can successfully call admin_get_analytics_insights'
);

SELECT ok(
    (public.admin_get_analytics_insights() ? 'cohorts'),
    'insights result includes cohorts'
);

SELECT ok(
    (public.admin_get_analytics_insights() ? 'customer_segments'),
    'insights result includes customer_segments'
);

SELECT ok(
    (public.admin_get_analytics_insights() ? 'sales_overview'),
    'insights result includes sales_overview'
);

SELECT ok(
    (public.admin_get_analytics_insights() ? 'product_performance'),
    'insights result includes product_performance'
);

SELECT ok(
    (public.admin_get_analytics_insights() ? 'discount_effect'),
    'insights result includes discount_effect'
);

SELECT ok(
    (public.admin_get_analytics_insights() ? 'fulfilment_quality'),
    'insights result includes fulfilment_quality'
);

SELECT ok(
    (public.admin_get_analytics_insights() ? 'geography'),
    'insights result includes geography'
);

SELECT * FROM finish();
ROLLBACK;

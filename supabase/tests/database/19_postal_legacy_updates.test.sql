BEGIN;
SELECT plan(12);

SELECT tests.create_supabase_user('legacy_postal');
SELECT tests.create_supabase_user('other_postal');

-- Owner-only fixture setup models an upgraded database containing old rows.
-- The transaction rolls this back; application roles cannot bypass the guards.
ALTER TABLE public.orders ALTER COLUMN ship_postal_code DROP NOT NULL;
ALTER TABLE public.orders DISABLE TRIGGER require_order_postal_code;
ALTER TABLE public.profiles DISABLE TRIGGER require_profile_postal_code;
INSERT INTO public.orders (user_id, delivery_method, subtotal, shipping_fee, total,
  ship_name, ship_phone, ship_governorate, ship_address)
VALUES (tests.get_supabase_uid('legacy_postal'), 'representative', 100, 35, 135,
  'Legacy Buyer', '01012345678', 'Cairo', 'Historical Street') RETURNING id AS legacy_order \gset
UPDATE public.profiles SET address = 'Historical Street', governorate_id = 1
WHERE id = tests.get_supabase_uid('legacy_postal');
ALTER TABLE public.orders ENABLE TRIGGER require_order_postal_code;
ALTER TABLE public.profiles ENABLE TRIGGER require_profile_postal_code;

SELECT lives_ok(format($$UPDATE public.orders SET status = 'shipped' WHERE id = %s$$, :legacy_order),
  'Legacy order can progress without fabricating its missing postal code');
SELECT is((SELECT ship_postal_code FROM public.orders WHERE id = :legacy_order), NULL,
  'Historical missing postal code remains missing');
SELECT throws_ok($$INSERT INTO public.orders (user_id, delivery_method, subtotal, shipping_fee, total,
  ship_name, ship_phone, ship_governorate, ship_address)
VALUES (tests.get_supabase_uid('legacy_postal'), 'representative', 100, 35, 135,
  'New Buyer', '01012345678', 'Cairo', 'New Street')$$,
  '23514', 'Postal code required for a new order', 'Legacy-compatible schema still rejects new orders missing postal code');
SELECT throws_ok(format($$UPDATE public.orders SET ship_postal_code = 'abcde' WHERE id = %s$$, :legacy_order),
  '23514', 'Postal code required for a new order', 'Legacy repair cannot use a fake code');

SELECT tests.authenticate_as('legacy_postal');
SELECT lives_ok($$UPDATE public.profiles SET full_name = 'Updated Name' WHERE id = auth.uid()$$,
  'Unrelated profile edits work for historical addresses');
SELECT throws_ok($$UPDATE public.profiles SET address = 'New Street' WHERE id = auth.uid()$$,
  '23514', 'Postal code required for a saved address', 'Changing a legacy address requires postal code');
SELECT lives_ok($$UPDATE public.profiles SET address = 'New Street', postal_code = '01234' WHERE id = auth.uid()$$,
  'Customer can complete a historical address with a real postal code');
SELECT throws_ok($$UPDATE public.profiles SET postal_code = NULL WHERE id = auth.uid()$$,
  '23514', 'Postal code required for a saved address', 'Customer cannot remove required code from saved address');
SELECT lives_ok($$UPDATE public.profiles SET address = NULL, governorate_id = NULL, postal_code = NULL WHERE id = auth.uid()$$,
  'Removing the entire saved address remains possible');
SELECT throws_ok(format($$UPDATE public.orders SET ship_postal_code = '11511' WHERE id = %s$$, :legacy_order),
  '42501', NULL, 'Customer cannot rewrite an order address snapshot');
UPDATE public.profiles SET postal_code = '11511' WHERE id = tests.get_supabase_uid('other_postal');
SELECT tests.authenticate_as_service_role();
SELECT is((SELECT postal_code FROM public.profiles WHERE id = tests.get_supabase_uid('other_postal')), NULL,
  'Customer cannot change another customer postal code');
SELECT ok(NOT has_function_privilege('anon', 'public.guard_order_postal_code()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.guard_profile_postal_code()', 'EXECUTE'),
  'Guard functions are not exposed as callable RPCs');

SELECT * FROM finish();
ROLLBACK;

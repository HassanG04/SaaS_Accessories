BEGIN;
SELECT plan(25);
SELECT tests.create_supabase_user('content_admin');
SELECT tests.create_supabase_user('content_customer');
UPDATE public.profiles SET role = 'admin' WHERE id = tests.get_supabase_uid('content_admin');
SELECT updated_at AS revision FROM public.shop_settings WHERE key = 'storefront_content' \gset

SELECT tests.clear_authentication();
SELECT is((SELECT value FROM public.shop_settings WHERE key = 'storefront_content'), '{}'::jsonb,
  'Anonymous visitors read the public document with existing copy preserved by default');
SELECT throws_ok(format($$SELECT public.admin_update_storefront_content('{}', %L)$$, :'revision'),
  '42501', NULL, 'Anonymous visitors cannot edit');
SELECT tests.authenticate_as('content_customer');
SELECT throws_ok(format($$SELECT public.admin_update_storefront_content('{}', %L)$$, :'revision'),
  '42501', NULL, 'Customers cannot edit');
SELECT throws_ok($$UPDATE public.shop_settings SET value = '{}' WHERE key = 'storefront_content'$$,
  '42501', NULL, 'Direct table writes remain denied');
SELECT tests.authenticate_as('content_admin', 'aal1');
SELECT throws_ok(format($$SELECT public.admin_update_storefront_content('{}', %L)$$, :'revision'),
  '42501', NULL, 'Admin without MFA cannot edit');
SELECT tests.authenticate_as('content_admin', 'aal2');
SELECT throws_ok($$SELECT public.admin_update_storefront_content('[]', NULL)$$,
  '22023', 'Invalid storefront content', 'Document must be an object');
SELECT throws_ok($$SELECT public.admin_update_storefront_content('{"instapay_handle":"attacker"}', NULL)$$,
  '22023', 'Content field not allowed', 'Payment settings cannot be changed through public content');
SELECT throws_ok($$SELECT public.admin_update_storefront_content('{"hero_title_ar":"عنوان"}', NULL)$$,
  '22023', 'Both translations required', 'Incomplete bilingual publication rejected');
SELECT throws_ok($$SELECT public.admin_update_storefront_content('{"hero_title_en":42}', NULL)$$,
  '22023', 'Invalid localized content', 'Localized text cannot be a number');
SELECT throws_ok($$SELECT public.admin_update_storefront_content(jsonb_build_object('terms_body_en',repeat('a',12001)), NULL)$$,
  '22023', 'Invalid localized content', 'Policy length bounded');
SELECT throws_ok($$SELECT public.admin_update_storefront_content('{"hero_image_path":"https://evil.example/a.svg"}', NULL)$$,
  '22023', 'Invalid hero image', 'External or SVG hero URL rejected');
SELECT throws_ok($$SELECT public.admin_update_storefront_content('{"hero_image_path":"settings/hero-00000000-0000-0000-0000-000000000000.webp"}', NULL)$$,
  '22023', 'Invalid hero image', 'Nonexistent image rejected');
SELECT throws_ok($$SELECT public.admin_update_storefront_content('{"featured_product_id":9999999999999}', NULL)$$,
  '22023', 'Featured product unavailable', 'Unknown featured product rejected');
SELECT throws_ok($$SELECT public.admin_update_storefront_content('{"category_ids":[1,1]}', NULL)$$,
  '22023', 'Duplicate content item', 'Duplicate shortcuts rejected');
SELECT throws_ok($$SELECT public.admin_update_storefront_content('{"category_ids":[null]}', NULL)$$,
  '22023', 'Duplicate content item', 'Null shortcuts rejected');
SELECT throws_ok($$SELECT public.admin_update_storefront_content('{"footer_order":["javascript:alert(1)"]}', NULL)$$,
  '22023', 'Invalid footer route', 'Arbitrary footer destinations rejected');
SELECT throws_ok($$SELECT public.admin_update_storefront_content('{"footer_order":["terms"]}', NULL)$$,
  '22023', 'All policy links required', 'Policy links cannot be silently removed');
SELECT throws_ok($$SELECT public.admin_update_storefront_content('{"instagram_url":"https://instagram.com.evil.example/test"}', NULL)$$,
  '22023', 'Invalid public contact', 'Lookalike social hostname rejected');

SELECT public.admin_update_storefront_content(
  '{"hero_title_ar":"عنوان","hero_title_en":"Title","terms_body_ar":"نص","terms_body_en":"<script>plain text</script>","footer_order":["contact","terms","privacy","shipping","returns"],"featured_product_id":null}',
  :'revision') AS saved_revision \gset
SELECT isnt(:'saved_revision'::timestamptz, :'revision'::timestamptz, 'Successful save advances revision');
SELECT is((SELECT value->>'hero_title_en' FROM public.shop_settings WHERE key = 'storefront_content'),
  'Title', 'Bilingual content persisted atomically');
SELECT is(public.admin_update_storefront_content('{}', :'revision'), NULL,
  'Stale editor cannot overwrite a newer save');
SELECT is((SELECT value->>'hero_title_en' FROM public.shop_settings WHERE key = 'storefront_content'),
  'Title', 'Conflicting save leaves published copy unchanged');
SELECT ok(exists(select 1 from public.audit_log where entity = 'shop_settings'
  and entity_id = 'storefront_content' and actor = tests.get_supabase_uid('content_admin')
  and new->'value'->>'hero_title_en' = 'Title'), 'Save leaves actor and content audit evidence');
SELECT tests.clear_authentication();
SELECT is((SELECT value->>'terms_body_en' FROM public.shop_settings WHERE key = 'storefront_content'),
  '<script>plain text</script>', 'Stored policy is plain text for escaped rendering');
SELECT is((SELECT count(*)::int FROM public.shop_settings WHERE key in ('instapay_handle','instapay_qr_path')),
  0, 'Public content does not expose approval-only payment instructions');
SELECT * FROM finish();
ROLLBACK;

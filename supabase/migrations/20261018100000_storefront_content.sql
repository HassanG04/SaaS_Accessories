-- T-3.10c: one audited, public, bilingual content document; payment settings
-- stay separate and private. Empty document preserves existing storefront copy.
insert into public.shop_settings (key, value, is_public)
values ('storefront_content', '{}'::jsonb, true)
on conflict (key) do nothing;

create or replace function public.admin_update_storefront_content(
  p_content jsonb, p_expected_updated_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision timestamptz;
  v_key text;
  v_value jsonb;
  v_text text;
  v_base text;
  v_id bigint;
  v_seen text[];
  v_item jsonb;
  v_text_fields text[] := array[
    'hero_title', 'hero_subtitle', 'hero_caption', 'hero_badge',
    'brand_name', 'tagline', 'copyright', 'announcement',
    'about_title', 'about_body', 'delivery_title', 'delivery_body',
    'returns_title', 'returns_summary', 'returns_body',
    'terms_label', 'terms_body', 'privacy_label', 'privacy_body',
    'returns_label', 'shipping_label', 'shipping_body', 'contact_label', 'contact_body'
  ];
begin
  perform public.require_admin();
  if p_content is null or jsonb_typeof(p_content) <> 'object'
     or octet_length(p_content::text) > 160000 then
    raise exception 'Invalid storefront content' using errcode = '22023', hint = 'ADM-007';
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_content) loop
    v_text := v_value #>> '{}';
    v_base := regexp_replace(v_key, '_(ar|en)$', '');
    if v_key ~ '_(ar|en)$' and v_base = any(v_text_fields) then
      if jsonb_typeof(v_value) <> 'string' or char_length(v_text) >
         (case when v_base like '%_body' then 12000 else 500 end) then
        raise exception 'Invalid localized content' using errcode = '22023', hint = 'ADM-007';
      end if;
    elsif v_key = 'hero_image_path' then
      if jsonb_typeof(v_value) <> 'string' or (v_text <> '' and (
        v_text !~ '^settings/hero-[0-9a-f-]{36}\.(webp|jpg|png)$' or not exists (
          select 1 from storage.objects where bucket_id = 'product-images' and name = v_text
        ))) then
        raise exception 'Invalid hero image' using errcode = '22023', hint = 'ADM-007';
      end if;
    elsif v_key = 'featured_product_id' then
      if v_value <> 'null'::jsonb then
        if jsonb_typeof(v_value) <> 'number' or v_text !~ '^[1-9][0-9]{0,14}$' then
          raise exception 'Invalid featured product' using errcode = '22023', hint = 'ADM-007';
        end if;
        if not exists (select 1 from public.products where id = v_text::bigint and is_active) then
          raise exception 'Featured product unavailable' using errcode = '22023', hint = 'ADM-007';
        end if;
      end if;
    elsif v_key in ('category_ids', 'footer_order') then
      if jsonb_typeof(v_value) <> 'array' then
        raise exception 'Invalid content list' using errcode = '22023', hint = 'ADM-007';
      end if;
      if jsonb_array_length(v_value) > 12 then
        raise exception 'Content list too long' using errcode = '22023', hint = 'ADM-007';
      end if;
      v_seen := array[]::text[];
      for v_item in select value from jsonb_array_elements(v_value) loop
        v_text := v_item #>> '{}';
        if v_text is null or v_text = any(v_seen) then
          raise exception 'Duplicate content item' using errcode = '22023', hint = 'ADM-007';
        end if;
        v_seen := array_append(v_seen, v_text);
        if v_key = 'category_ids' then
          if jsonb_typeof(v_item) <> 'number' or v_text !~ '^[1-9][0-9]{0,14}$' then
            raise exception 'Invalid category' using errcode = '22023', hint = 'ADM-007';
          end if;
          v_id := v_text::bigint;
          if not exists (select 1 from public.categories where id = v_id and is_active) then
            raise exception 'Category unavailable' using errcode = '22023', hint = 'ADM-007';
          end if;
        elsif jsonb_typeof(v_item) <> 'string' or v_text not in ('terms','privacy','returns','shipping','contact') then
          raise exception 'Invalid footer route' using errcode = '22023', hint = 'ADM-007';
        end if;
      end loop;
      if v_key = 'footer_order' and cardinality(v_seen) <> 5 then
        raise exception 'All policy links required' using errcode = '22023', hint = 'ADM-007';
      end if;
    elsif v_key in ('phone', 'whatsapp_url', 'instagram_url', 'tiktok_url') then
      if jsonb_typeof(v_value) <> 'string' or char_length(v_text) > 500 or (v_text <> '' and not (
        (v_key = 'phone' and v_text ~ '^\+?[0-9 ()-]{6,30}$') or
        (v_key = 'whatsapp_url' and v_text ~ '^https://(wa\.me|chat\.whatsapp\.com)/[A-Za-z0-9_/?=&%-]+$') or
        (v_key = 'instagram_url' and v_text ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9_./?=&%-]+$') or
        (v_key = 'tiktok_url' and v_text ~ '^https://(www\.)?tiktok\.com/@[A-Za-z0-9_./?=&%-]+$')
      )) then
        raise exception 'Invalid public contact' using errcode = '22023', hint = 'ADM-007';
      end if;
    else
      raise exception 'Content field not allowed' using errcode = '22023', hint = 'ADM-008';
    end if;
  end loop;
  foreach v_base in array v_text_fields loop
    if (nullif(trim(p_content ->> (v_base || '_ar')), '') is null)
       <> (nullif(trim(p_content ->> (v_base || '_en')), '') is null) then
      raise exception 'Both translations required' using errcode = '22023', hint = 'ADM-007';
    end if;
  end loop;

  select updated_at into v_revision from public.shop_settings
    where key = 'storefront_content' for update;
  -- A stale revision is an expected editing conflict, not a raw database error.
  if v_revision is distinct from p_expected_updated_at then return null; end if;
  update public.shop_settings set value = p_content,
    updated_at = clock_timestamp(), updated_by = auth.uid()
    where key = 'storefront_content' returning updated_at into v_revision;
  return v_revision;
end;
$$;
revoke all on function public.admin_update_storefront_content(jsonb, timestamptz) from public, anon;
grant execute on function public.admin_update_storefront_content(jsonb, timestamptz) to authenticated;

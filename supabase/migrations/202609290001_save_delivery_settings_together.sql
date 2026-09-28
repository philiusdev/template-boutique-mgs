drop function public.update_store_delivery_settings(uuid, numeric, text, text);

create function public.update_store_delivery_settings(
  p_city_id uuid,
  p_local_delivery_fee numeric,
  p_shop_address text,
  p_shop_hours text,
  p_shop_phone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Accès administrateur requis';
  end if;
  if p_local_delivery_fee is null or p_local_delivery_fee < 0 then
    raise exception 'Le prix de livraison ne peut pas être négatif';
  end if;
  if not exists (select 1 from public.cities where id = p_city_id) then
    raise exception 'Ville introuvable';
  end if;
  if nullif(trim(p_shop_phone), '') is not null
     and p_shop_phone !~ '^\+226 [0-9]{2}( [0-9]{2}){3}$' then
    raise exception 'Le numéro de la boutique doit contenir 8 chiffres après +226';
  end if;

  update public.cities set is_seller_city = false where is_seller_city;
  update public.cities set is_seller_city = true where id = p_city_id;

  insert into public.settings(key, value) values
    ('local_delivery_fee', jsonb_build_object('amount', p_local_delivery_fee)),
    ('shop_address', jsonb_build_object('text', coalesce(p_shop_address, ''))),
    ('shop_hours', jsonb_build_object('text', coalesce(p_shop_hours, ''))),
    ('shop_phone', jsonb_build_object('text', coalesce(p_shop_phone, '')))
  on conflict (key) do update
    set value = excluded.value, updated_at = now();
end;
$$;

revoke all on function public.update_store_delivery_settings(uuid, numeric, text, text, text) from public;
grant execute on function public.update_store_delivery_settings(uuid, numeric, text, text, text) to authenticated;

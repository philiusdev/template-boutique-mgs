create or replace function public.cleanup_carrier_routes_before_city_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_seller_city then
    raise exception 'Choisissez une autre ville pour la boutique avant de supprimer celle-ci';
  end if;

  update public.transport_companies
    set served_city_ids = array_remove(served_city_ids, old.id)
    where old.id = any(served_city_ids);

  return old;
end;
$$;

revoke all on function public.cleanup_carrier_routes_before_city_delete() from public;

create trigger cities_cleanup_carrier_routes
before delete on public.cities
for each row execute procedure public.cleanup_carrier_routes_before_city_delete();

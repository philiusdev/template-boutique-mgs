alter table public.profiles
  add column if not exists phone_number text;
grant update (phone_number) on public.profiles to authenticated;

alter table public.profiles
  add constraint profiles_phone_number_format
  check (
    phone_number is null
    or phone_number ~ '^\+?[0-9][0-9 ()-]{7,18}$'
  );

alter table public.orders
  add column if not exists contact_phone text;

alter table public.orders
  add constraint orders_contact_phone_format
  check (
    contact_phone is null
    or contact_phone ~ '^\+?[0-9][0-9 ()-]{7,18}$'
  );

alter table public.order_items
  add column if not exists product_image_snapshot text;

update public.order_items oi
set product_image_snapshot = p.images[1]
from public.products p
where oi.product_id = p.id
  and oi.product_image_snapshot is null
  and cardinality(p.images) > 0;

create or replace function public.snapshot_order_item_image()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.product_image_snapshot is null and new.product_id is not null then
    select p.images[1]
      into new.product_image_snapshot
      from public.products p
      where p.id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists order_items_snapshot_image on public.order_items;
create trigger order_items_snapshot_image
  before insert on public.order_items
  for each row execute procedure public.snapshot_order_item_image();

create or replace function public.save_order_contact_phone(
  p_order_id uuid,
  p_phone_number text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise';
  end if;
  if p_phone_number is null or p_phone_number !~ '^\+?[0-9][0-9 ()-]{7,18}$' then
    raise exception 'Numéro de téléphone invalide';
  end if;
  update public.orders
    set contact_phone = trim(p_phone_number)
    where id = p_order_id
      and user_id = (select auth.uid())
      and status in ('pending_payment', 'rejected');
  if not found then
    raise exception 'Commande introuvable ou non modifiable';
  end if;
end;
$$;
revoke all on function public.save_order_contact_phone(uuid, text) from public;
grant execute on function public.save_order_contact_phone(uuid, text) to authenticated;

do $$
declare
  v_table text;
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    return;
  end if;

  foreach v_table in array array['profiles', 'order_items']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;

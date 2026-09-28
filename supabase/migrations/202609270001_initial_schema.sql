create extension if not exists pgcrypto;

create type public.order_status as enum (
  'pending_payment', 'pending_verification', 'verified', 'preparing',
  'ready_for_pickup', 'shipped', 'delivered', 'rejected', 'cancelled'
);
create type public.delivery_type as enum ('store_pickup', 'local_delivery', 'intercity');
create type public.proof_status as enum ('pending', 'verified', 'rejected');

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_seller_city boolean not null default false
);
create unique index one_seller_city on public.cities (is_seller_city) where is_seller_city;

create table public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city_id uuid not null references public.cities(id) on delete cascade,
  unique (city_id, name),
  unique (id, city_id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'client' check (role in ('client', 'admin')),
  full_name text,
  default_city_id uuid,
  default_neighborhood_id uuid,
  created_at timestamptz not null default now(),
  check ((default_city_id is null) = (default_neighborhood_id is null)),
  foreign key (default_neighborhood_id, default_city_id)
    references public.neighborhoods(id, city_id) on delete set null
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.transport_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  served_city_ids uuid[] not null default '{}',
  estimated_price numeric(12,2) check (estimated_price is null or estimated_price >= 0),
  estimated_days integer check (estimated_days is null or estimated_days > 0),
  active boolean not null default true
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(12,2) not null check (price > 0),
  category_id uuid references public.categories(id) on delete set null,
  size text,
  condition text not null default 'occasion'
    check (condition in ('neuf', 'excellent', 'tres_bon', 'bon', 'occasion')),
  stock integer not null default 0 check (stock >= 0),
  images text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  status public.order_status not null default 'pending_payment',
  city_id uuid not null references public.cities(id),
  neighborhood_id uuid not null,
  delivery_type public.delivery_type not null,
  transport_company_id uuid references public.transport_companies(id) on delete set null,
  delivery_address_note text,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) not null check (total >= 0),
  stock_reserved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (neighborhood_id, city_id) references public.neighborhoods(id, city_id),
  check (total = subtotal + delivery_fee),
  check (
    (delivery_type = 'intercity' and transport_company_id is not null)
    or (delivery_type <> 'intercity' and transport_company_id is null)
  )
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name_snapshot text not null,
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot > 0),
  quantity integer not null check (quantity > 0)
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_number text not null,
  instructions text not null,
  active boolean not null default true,
  display_order integer not null default 0
);

create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  screenshot_url text not null,
  payment_method text not null,
  status public.proof_status not null default 'pending',
  rejection_reason text,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'rejected' or rejection_reason is not null),
  check (status = 'pending' or verified_at is not null)
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index products_catalog_idx on public.products (active, category_id, created_at desc);
create index orders_customer_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index order_items_order_idx on public.order_items (order_id);
create index neighborhoods_city_idx on public.neighborhoods (city_id);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger orders_touch_updated_at before update on public.orders
  for each row execute procedure public.touch_updated_at();
create trigger settings_touch_updated_at before update on public.settings
  for each row execute procedure public.touch_updated_at();

create or replace function public.release_order_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.stock_reserved and new.status in ('rejected', 'cancelled')
     and old.status not in ('rejected', 'cancelled') then
    update public.products p
      set stock = p.stock + oi.quantity
      from public.order_items oi
      where oi.order_id = new.id and oi.product_id = p.id;
    update public.orders set stock_reserved = false where id = new.id;
  end if;
  return new;
end;
$$;
create trigger orders_release_stock after update of status on public.orders
  for each row execute procedure public.release_order_stock();

alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.categories enable row level security;
alter table public.transport_companies enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.settings enable row level security;

create policy "profile owner or admin reads profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profile owner updates own details" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy "admin manages profiles" on public.profiles
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "public reads active products" on public.products
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy "admin manages products" on public.products
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "public reads categories" on public.categories
  for select to anon, authenticated using (true);
create policy "admin manages categories" on public.categories
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "public reads cities" on public.cities
  for select to anon, authenticated using (true);
create policy "admin manages cities" on public.cities
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "public reads neighborhoods" on public.neighborhoods
  for select to anon, authenticated using (true);
create policy "admin manages neighborhoods" on public.neighborhoods
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "public reads active carriers" on public.transport_companies
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy "admin manages carriers" on public.transport_companies
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "public reads active payment methods" on public.payment_methods
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy "admin manages payment methods" on public.payment_methods
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "public reads shop settings" on public.settings
  for select to anon, authenticated using (true);
create policy "admin manages shop settings" on public.settings
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "customer or admin reads orders" on public.orders
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "admin updates orders" on public.orders
  for update to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "owner or admin reads order items" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id
      and (o.user_id = (select auth.uid()) or (select public.is_admin())))
  );
create policy "owner or admin reads payment proofs" on public.payment_proofs
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id
      and (o.user_id = (select auth.uid()) or (select public.is_admin())))
  );
create policy "admin reviews payment proofs" on public.payment_proofs
  for update to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.place_order(
  p_city_id uuid,
  p_neighborhood_id uuid,
  p_delivery_type public.delivery_type,
  p_transport_company_id uuid,
  p_delivery_address_note text,
  p_items jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_seller_city uuid;
  v_fee numeric(12,2) := 0;
  v_subtotal numeric(12,2) := 0;
  v_order_id uuid := gen_random_uuid();
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
begin
  if v_user_id is null then raise exception 'Authentification requise'; end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0 then raise exception 'Le panier est vide'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) as i(value)
    group by i.value->>'product_id' having count(*) > 1
  ) then raise exception 'Article dupliqué dans le panier'; end if;
  if not exists (select 1 from public.neighborhoods
      where id = p_neighborhood_id and city_id = p_city_id) then
    raise exception 'Quartier invalide pour cette ville';
  end if;
  select id into v_seller_city from public.cities where is_seller_city limit 1;
  if p_delivery_type in ('store_pickup', 'local_delivery') and p_city_id <> v_seller_city then
    raise exception 'Livraison locale indisponible dans cette ville';
  end if;
  if p_delivery_type = 'intercity' then
    if p_city_id = v_seller_city or p_transport_company_id is null or not exists (
      select 1 from public.transport_companies c
      where c.id = p_transport_company_id and c.active
        and p_city_id = any(c.served_city_ids)
    ) then raise exception 'Transporteur indisponible pour cette ville'; end if;
    select coalesce(estimated_price, 0) into v_fee
    from public.transport_companies where id = p_transport_company_id;
  elsif p_delivery_type = 'local_delivery' then
    select coalesce((value->>'amount')::numeric, 1000) into v_fee
    from public.settings where key = 'local_delivery_fee';
    v_fee := coalesce(v_fee, 1000);
  elsif p_delivery_type = 'store_pickup' then
    v_fee := 0;
  end if;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity') !~ '^[1-9][0-9]*$' then raise exception 'Quantité invalide'; end if;
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and active for update;
    if not found or v_product.stock < v_quantity then raise exception 'Stock insuffisant'; end if;
    v_subtotal := v_subtotal + v_product.price * v_quantity;
  end loop;
  insert into public.orders (
    id, user_id, city_id, neighborhood_id, delivery_type,
    transport_company_id, delivery_address_note, subtotal, delivery_fee, total
  ) values (
    v_order_id, v_user_id, p_city_id, p_neighborhood_id, p_delivery_type,
    case when p_delivery_type = 'intercity' then p_transport_company_id end,
    nullif(trim(p_delivery_address_note), ''), v_subtotal, v_fee, v_subtotal + v_fee
  );
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and active for update;
    update public.products set stock = stock - v_quantity where id = v_product.id;
    insert into public.order_items (
      order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity
    ) values (v_order_id, v_product.id, v_product.name, v_product.price, v_quantity);
  end loop;
  return v_order_id;
end;
$$;

create or replace function public.submit_payment_proof(
  p_order_id uuid,
  p_screenshot_path text,
  p_payment_method_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_method_name text;
  v_item record;
begin
  if v_user_id is null then raise exception 'Authentification requise'; end if;
  if p_screenshot_path not like (v_user_id::text || '/' || p_order_id::text || '/%') then
    raise exception 'Chemin de preuve invalide';
  end if;
  select name into v_method_name from public.payment_methods
    where id = p_payment_method_id and active;
  if v_method_name is null then raise exception 'Moyen de paiement inactif'; end if;
  select * into v_order from public.orders
    where id = p_order_id and user_id = v_user_id for update;
  if not found or v_order.status not in ('pending_payment', 'rejected') then
    raise exception 'Commande introuvable ou non modifiable';
  end if;
  if v_order.status = 'rejected' and not v_order.stock_reserved then
    for v_item in select product_id, quantity from public.order_items
      where order_id = p_order_id and product_id is not null
    loop
      update public.products set stock = stock - v_item.quantity
        where id = v_item.product_id and active and stock >= v_item.quantity;
      if not found then raise exception 'Stock insuffisant pour renvoyer la preuve'; end if;
    end loop;
  end if;
  insert into public.payment_proofs (
    order_id, screenshot_url, payment_method, status, rejection_reason, verified_by, verified_at
  ) values (p_order_id, p_screenshot_path, v_method_name, 'pending', null, null, null)
  on conflict (order_id) do update set
    screenshot_url = excluded.screenshot_url,
    payment_method = excluded.payment_method,
    status = 'pending', rejection_reason = null,
    verified_by = null, verified_at = null, created_at = now();
  update public.orders set status = 'pending_verification', stock_reserved = true
    where id = p_order_id;
end;
$$;

create or replace function public.review_payment_proof(
  p_proof_id uuid,
  p_approved boolean,
  p_rejection_reason text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order_id uuid;
begin
  if not (select public.is_admin()) then raise exception 'Accès administrateur requis'; end if;
  if not p_approved and nullif(trim(p_rejection_reason), '') is null then
    raise exception 'Un motif est requis pour refuser une preuve';
  end if;
  update public.payment_proofs set
    status = case when p_approved then 'verified'::public.proof_status else 'rejected'::public.proof_status end,
    rejection_reason = case when p_approved then null else trim(p_rejection_reason) end,
    verified_at = now(), verified_by = (select auth.uid())
  where id = p_proof_id and status = 'pending'
  returning order_id into v_order_id;
  if v_order_id is null then raise exception 'Preuve absente ou déjà traitée'; end if;
  update public.orders set status = case
    when p_approved then 'verified'::public.order_status
    else 'rejected'::public.order_status end
  where id = v_order_id and status = 'pending_verification';
end;
$$;

create or replace function public.update_store_delivery_settings(
  p_city_id uuid,
  p_local_delivery_fee numeric,
  p_shop_address text,
  p_shop_hours text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'Accès administrateur requis'; end if;
  if p_local_delivery_fee < 0 then raise exception 'Tarif invalide'; end if;
  if not exists (select 1 from public.cities where id = p_city_id) then
    raise exception 'Ville introuvable';
  end if;
  update public.cities set is_seller_city = false where is_seller_city;
  update public.cities set is_seller_city = true where id = p_city_id;
  insert into public.settings(key, value) values
    ('local_delivery_fee', jsonb_build_object('amount', p_local_delivery_fee)),
    ('shop_address', jsonb_build_object('text', p_shop_address)),
    ('shop_hours', jsonb_build_object('text', p_shop_hours))
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;

create or replace function public.admin_dashboard_stats()
returns table (
  total_orders bigint, pending_payments bigint, approved_revenue numeric,
  active_products bigint, low_stock_products bigint, best_sellers jsonb
)
language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'Accès administrateur requis'; end if;
  return query select
    (select count(*) from public.orders),
    (select count(*) from public.orders where status = 'pending_verification'),
    coalesce((select sum(total) from public.orders
      where status in ('verified', 'preparing', 'ready_for_pickup', 'shipped', 'delivered')), 0),
    (select count(*) from public.products where active),
    (select count(*) from public.products where active and stock <= 2),
    coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'quantity', s.quantity))
      from (select oi.product_name_snapshot as name, sum(oi.quantity)::bigint as quantity
        from public.order_items oi join public.orders o on o.id = oi.order_id
        where o.status not in ('rejected', 'cancelled')
        group by oi.product_name_snapshot order by quantity desc limit 5) s), '[]'::jsonb);
end;
$$;

revoke all on function public.place_order(uuid, uuid, public.delivery_type, uuid, text, jsonb) from public;
revoke all on function public.submit_payment_proof(uuid, text, uuid) from public;
revoke all on function public.review_payment_proof(uuid, boolean, text) from public;
revoke all on function public.update_store_delivery_settings(uuid, numeric, text, text) from public;
revoke all on function public.admin_dashboard_stats() from public;
grant execute on function public.place_order(uuid, uuid, public.delivery_type, uuid, text, jsonb) to authenticated;
grant execute on function public.submit_payment_proof(uuid, text, uuid) to authenticated;
grant execute on function public.review_payment_proof(uuid, boolean, text) to authenticated;
grant execute on function public.update_store_delivery_settings(uuid, numeric, text, text) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "public reads product photos" on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-images');
create policy "admin uploads product photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'product-images' and (select public.is_admin())
  );
create policy "admin changes product photos" on storage.objects
  for update to authenticated using (
    bucket_id = 'product-images' and (select public.is_admin())
  ) with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "admin deletes product photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'product-images' and (select public.is_admin())
  );
create policy "customer uploads own proof" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[2]
        and o.user_id = (select auth.uid())
        and o.status in ('pending_payment', 'rejected')
    )
  );
create policy "customer or admin reads proof" on storage.objects
  for select to authenticated using (
    bucket_id = 'payment-proofs'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

grant usage on schema public to anon, authenticated;
grant select on public.products, public.categories, public.cities, public.neighborhoods,
  public.transport_companies, public.payment_methods, public.settings to anon, authenticated;
grant select on public.profiles, public.orders, public.order_items, public.payment_proofs to authenticated;
grant update (full_name, default_city_id, default_neighborhood_id) on public.profiles to authenticated;
grant insert, update, delete on public.products, public.categories, public.cities, public.neighborhoods,
  public.transport_companies, public.payment_methods, public.settings to authenticated;
grant update on public.orders, public.payment_proofs to authenticated;

insert into public.cities (name, is_seller_city) values
  ('Bobo-Dioulasso', true), ('Ouagadougou', false), ('Koudougou', false),
  ('Banfora', false), ('Ouahigouya', false), ('Dédougou', false),
  ('Kaya', false), ('Tenkodogo', false), ('Fada N''Gourma', false),
  ('Gaoua', false), ('Dori', false), ('Koupéla', false)
on conflict (name) do nothing;
insert into public.neighborhoods (city_id, name)
select c.id, n.name
from (values
  ('Bobo-Dioulasso', 'Accart-ville'),
  ('Bobo-Dioulasso', 'Belle-Ville'),
  ('Bobo-Dioulasso', 'Bindougousso'),
  ('Bobo-Dioulasso', 'Bolomakoté'),
  ('Bobo-Dioulasso', 'Colsama'),
  ('Bobo-Dioulasso', 'Dogona'),
  ('Bobo-Dioulasso', 'Farakan'),
  ('Bobo-Dioulasso', 'Kua'),
  ('Bobo-Dioulasso', 'Kuinima'),
  ('Bobo-Dioulasso', 'Konsa'),
  ('Bobo-Dioulasso', 'Lafiabougou'),
  ('Bobo-Dioulasso', 'Léguéma'),
  ('Bobo-Dioulasso', 'Niénéta'),
  ('Bobo-Dioulasso', 'Sarfalao'),
  ('Bobo-Dioulasso', 'Sakaby'),
  ('Bobo-Dioulasso', 'Tounouma'),
  ('Bobo-Dioulasso', 'Yéguéré'),
  ('Ouagadougou', 'Balkuy'),
  ('Ouagadougou', 'Bassinko'),
  ('Ouagadougou', 'Bendogo'),
  ('Ouagadougou', 'Bissighin'),
  ('Ouagadougou', 'Bonheur-Ville'),
  ('Ouagadougou', 'Boulmiougou'),
  ('Ouagadougou', 'Cissin'),
  ('Ouagadougou', 'Dagnoën'),
  ('Ouagadougou', 'Dapoya'),
  ('Ouagadougou', 'Dassasgho'),
  ('Ouagadougou', 'Gounghin'),
  ('Ouagadougou', 'Karpala'),
  ('Ouagadougou', 'Katre Yaar'),
  ('Ouagadougou', 'Kalgondin'),
  ('Ouagadougou', 'Kilwin'),
  ('Ouagadougou', 'Kossodo'),
  ('Ouagadougou', 'Koulouba'),
  ('Ouagadougou', 'Nagrin'),
  ('Ouagadougou', 'Nioko 1'),
  ('Ouagadougou', 'Nioko 2'),
  ('Ouagadougou', 'Nonsin'),
  ('Ouagadougou', 'Ouaga 2000'),
  ('Ouagadougou', 'Paspanga'),
  ('Ouagadougou', 'Patte d''Oie'),
  ('Ouagadougou', 'Pissy'),
  ('Ouagadougou', 'Rimkièta'),
  ('Ouagadougou', 'Saaba'),
  ('Ouagadougou', 'Silmiougou'),
  ('Ouagadougou', 'Somgandé'),
  ('Ouagadougou', 'Tanghin'),
  ('Ouagadougou', 'Tampouy'),
  ('Ouagadougou', 'Wayalghin'),
  ('Ouagadougou', 'Wemtenga'),
  ('Ouagadougou', 'Zagtouli'),
  ('Ouagadougou', 'Zogona'),
  ('Ouagadougou', 'Zone du Bois')
) as n(city_name, name)
join public.cities c on c.name = n.city_name
on conflict (city_id, name) do nothing;
insert into public.neighborhoods (city_id, name)
select c.id, 'Secteur ' || sector.number
from public.cities c
cross join generate_series(1, 33) as sector(number)
where c.name = 'Bobo-Dioulasso'
on conflict (city_id, name) do nothing;
insert into public.neighborhoods (city_id, name)
select c.id, 'Secteur ' || sector.number
from public.cities c
cross join generate_series(1, 55) as sector(number)
where c.name = 'Ouagadougou'
on conflict (city_id, name) do nothing;
insert into public.categories (name, slug) values
  ('Robes', 'robes'), ('Hauts', 'hauts'), ('Pantalons', 'pantalons'),
  ('Vestes', 'vestes'), ('Accessoires', 'accessoires')
on conflict (slug) do nothing;
insert into public.settings (key, value) values
  ('local_delivery_fee', '{"amount":1000}'::jsonb),
  ('shop_address', '{"text":"À renseigner par le vendeur"}'::jsonb),
  ('shop_hours', '{"text":"À renseigner par le vendeur"}'::jsonb)
on conflict (key) do nothing;

create table public.auth_rate_limit_events (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index auth_rate_limit_email_window_idx
  on public.auth_rate_limit_events (email_hash, created_at desc);
create index auth_rate_limit_ip_window_idx
  on public.auth_rate_limit_events (ip_hash, created_at desc);
alter table public.auth_rate_limit_events enable row level security;

create or replace function public.consume_auth_rate_limit(
  p_email_hash text,
  p_ip_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email_attempts integer;
  v_ip_attempts integer;
begin
  if p_email_hash !~ '^[0-9a-f]{64}$' or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Clé de limitation invalide';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_email_hash, 0));
  delete from public.auth_rate_limit_events where created_at < now() - interval '1 day';
  select count(*) into v_email_attempts
    from public.auth_rate_limit_events
    where email_hash = p_email_hash and created_at > now() - interval '15 minutes';
  select count(*) into v_ip_attempts
    from public.auth_rate_limit_events
    where ip_hash = p_ip_hash and created_at > now() - interval '15 minutes';
  if v_email_attempts >= 5 or v_ip_attempts >= 20 then
    return false;
  end if;
  insert into public.auth_rate_limit_events (email_hash, ip_hash)
    values (p_email_hash, p_ip_hash);
  return true;
end;
$$;
revoke all on function public.consume_auth_rate_limit(text, text) from public;
grant execute on function public.consume_auth_rate_limit(text, text) to service_role;

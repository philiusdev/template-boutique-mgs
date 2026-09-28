insert into public.cities (name, is_seller_city) values
  ('Manga', false),
  ('Ziniaré', false),
  ('Pô', false),
  ('Houndé', false),
  ('Orodara', false),
  ('Boromo', false),
  ('Nouna', false),
  ('Tougan', false),
  ('Kongoussi', false),
  ('Djibo', false),
  ('Réo', false),
  ('Léo', false),
  ('Kombissiri', false),
  ('Pama', false)
on conflict (name) do nothing;

insert into public.neighborhoods (city_id, name)
select id, 'Centre-ville'
from public.cities
where name in (
  'Manga', 'Ziniaré', 'Pô', 'Houndé', 'Orodara', 'Boromo', 'Nouna',
  'Tougan', 'Kongoussi', 'Djibo', 'Réo', 'Léo', 'Kombissiri', 'Pama'
)
on conflict (city_id, name) do nothing;

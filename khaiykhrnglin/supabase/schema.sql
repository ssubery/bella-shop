-- ລັນໃນ Supabase > SQL Editor (ຄັ້ງດຽວ)
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null default 0,
  category text,
  description text,
  photo_url text,
  in_stock boolean not null default true,     -- false = ສະແດງ "ໝົດແລ້ວ"
  is_visible boolean not null default true,   -- false = ເຊື່ອງຈາກຜູ້ເຂົ້າຊົມ
  created_at timestamptz default now()
);
alter table products enable row level security;
create policy "public read visible" on products for select using (is_visible);
create policy "admin all" on products for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('product-photos','product-photos', true) on conflict (id) do nothing;
create policy "public read photos" on storage.objects for select using (bucket_id = 'product-photos');
create policy "admin write photos" on storage.objects for all to authenticated
  using (bucket_id = 'product-photos') with check (bucket_id = 'product-photos');

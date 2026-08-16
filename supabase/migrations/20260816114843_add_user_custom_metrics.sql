create table public.user_custom_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  entity_type_slug text not null check (entity_type_slug ~ '^[a-z0-9-]{2,40}$'),
  formula jsonb not null,
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(formula) = 'object'),
  check (formula ->> 'version' = '1'),
  check (jsonb_typeof(formula -> 'components') = 'array'),
  check (jsonb_array_length(formula -> 'components') between 1 and 12)
);

create unique index user_custom_metrics_owner_name_idx
on public.user_custom_metrics (user_id, entity_type_slug, lower(name));

create index user_custom_metrics_owner_updated_idx
on public.user_custom_metrics (user_id, updated_at desc);

create trigger user_custom_metrics_set_updated_at
before update on public.user_custom_metrics
for each row execute function public.set_updated_at();

alter table public.user_custom_metrics enable row level security;

create policy "users read own custom metrics"
on public.user_custom_metrics for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users create own custom metrics"
on public.user_custom_metrics for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users update own custom metrics"
on public.user_custom_metrics for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users delete own custom metrics"
on public.user_custom_metrics for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_custom_metrics to authenticated;
grant all on public.user_custom_metrics to service_role;

create extension if not exists pgcrypto;

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create table public.entity_types (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  slug text not null,
  singular_name text not null,
  plural_name text not null,
  description text,
  presentation_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (domain_id, slug)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  avatar_url text,
  bio text,
  demographic_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (handle is null or handle ~ '^[a-zA-Z0-9_]{3,30}$')
);

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  entity_type_id uuid not null references public.entity_types(id),
  canonical_key text not null,
  name text not null,
  short_name text,
  description text,
  image_url text,
  color text,
  status text not null default 'active' check (status in ('active', 'archived', 'merged')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (domain_id, entity_type_id, canonical_key)
);

create table public.entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  alias text not null,
  normalized_alias text generated always as (lower(regexp_replace(alias, '[^a-zA-Z0-9]+', '', 'g'))) stored,
  alias_type text not null default 'name',
  unique (entity_id, normalized_alias)
);

create table public.entity_external_ids (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  source_slug text not null,
  external_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique (source_slug, external_id)
);

create table public.entity_relationships (
  id uuid primary key default gen_random_uuid(),
  from_entity_id uuid not null references public.entities(id) on delete cascade,
  to_entity_id uuid not null references public.entities(id) on delete cascade,
  relationship_type text not null,
  valid_from date,
  valid_to date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (from_entity_id, to_entity_id, relationship_type, valid_from)
);

create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  homepage_url text,
  rights_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  source_id uuid references public.data_sources(id),
  slug text not null,
  name text not null,
  description text,
  refresh_cadence text not null default 'weekly' check (refresh_cadence in ('live', 'hourly', 'daily', 'weekly', 'seasonal', 'manual')),
  created_at timestamptz not null default now(),
  unique (domain_id, slug)
);

create table public.dataset_versions (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  version_key text not null,
  season integer,
  week integer,
  status text not null default 'staging' check (status in ('staging', 'validated', 'published', 'failed', 'superseded')),
  fetched_at timestamptz not null default now(),
  published_at timestamptz,
  row_count integer not null default 0,
  source_request_count integer not null default 0,
  source_metadata jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  unique (dataset_id, version_key)
);

alter table public.datasets
  add column active_version_id uuid references public.dataset_versions(id);

create table public.attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  entity_type_id uuid not null references public.entity_types(id) on delete cascade,
  source_id uuid references public.data_sources(id),
  key text not null,
  label text not null,
  description text,
  value_type text not null check (value_type in ('number', 'text', 'boolean', 'date', 'json')),
  unit text,
  metric_group text,
  direction text check (direction in ('asc', 'desc')),
  freshness text not null default 'weekly' check (freshness in ('live', 'hourly', 'daily', 'weekly', 'seasonal', 'manual')),
  public_visible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (entity_type_id, key)
);

create table public.entity_attribute_values (
  id uuid primary key default gen_random_uuid(),
  dataset_version_id uuid not null references public.dataset_versions(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  attribute_definition_id uuid not null references public.attribute_definitions(id) on delete cascade,
  number_value double precision,
  text_value text,
  boolean_value boolean,
  date_value date,
  json_value jsonb,
  effective_at timestamptz not null default now(),
  source_metadata jsonb not null default '{}'::jsonb,
  check (num_nonnulls(number_value, text_value, boolean_value, date_value, json_value) = 1)
);

create index entity_attribute_values_lookup_idx
  on public.entity_attribute_values (dataset_version_id, entity_id, attribute_definition_id);

create table public.ranking_templates (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private', 'group')),
  template_kind text not null default 'community' check (template_kind in ('official', 'verified', 'community', 'custom', 'algorithmic')),
  status text not null default 'active' check (status in ('draft', 'active', 'archived', 'moderated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (domain_id, created_by, slug)
);

create table public.ranking_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.ranking_templates(id) on delete cascade,
  version integer not null,
  entity_type_id uuid not null references public.entity_types(id),
  ranking_method text not null default 'manual' check (ranking_method in ('manual', 'pairwise', 'scoring', 'tier', 'bracket', 'hybrid')),
  min_length integer not null check (min_length > 0),
  max_length integer not null check (max_length >= min_length),
  default_length integer not null check (default_length between min_length and max_length),
  exact_length boolean not null default true,
  eligibility_query jsonb not null default '{}'::jsonb,
  comparison_attribute_keys text[] not null default '{}',
  display_config jsonb not null default '{}'::jsonb,
  aggregate_eligible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

create table public.ranking_template_entities (
  template_version_id uuid not null references public.ranking_template_versions(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  seed_order integer,
  metadata jsonb not null default '{}'::jsonb,
  primary key (template_version_id, entity_id)
);

create table public.ranking_cycles (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.ranking_templates(id) on delete cascade,
  slug text not null,
  title text not null,
  season integer,
  week integer,
  opens_at timestamptz,
  closes_at timestamptz,
  status text not null default 'open' check (status in ('scheduled', 'open', 'closed', 'archived')),
  unique (template_id, slug)
);

create table public.rankings (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.ranking_template_versions(id),
  cycle_id uuid references public.ranking_cycles(id),
  author_id uuid references auth.users(id) on delete set null,
  dataset_version_id uuid references public.dataset_versions(id),
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn', 'moderated')),
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private', 'group')),
  title text,
  note text,
  revision integer not null default 0,
  supersedes_ranking_id uuid references public.rankings(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create index rankings_aggregate_lookup_idx
  on public.rankings (template_version_id, cycle_id, status, visibility, published_at desc);

create table public.ranking_placements (
  id uuid primary key default gen_random_uuid(),
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  entity_id uuid not null references public.entities(id),
  position integer not null check (position > 0),
  score double precision,
  rationale text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (ranking_id, entity_id),
  unique (ranking_id, position)
);

create index ranking_placements_entity_idx
  on public.ranking_placements (entity_id, position, ranking_id);

create table public.ranking_events (
  id bigint generated always as identity primary key,
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  client_revision integer,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.cohort_dimensions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  collection_method text not null,
  sensitive boolean not null default false,
  multi_select boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived'))
);

create table public.cohort_values (
  id uuid primary key default gen_random_uuid(),
  dimension_id uuid not null references public.cohort_dimensions(id) on delete cascade,
  slug text not null,
  label text not null,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique (dimension_id, slug)
);

create table public.user_cohort_values (
  user_id uuid not null references auth.users(id) on delete cascade,
  cohort_value_id uuid not null references public.cohort_values(id) on delete cascade,
  consented_at timestamptz not null default now(),
  source text not null default 'self-selected',
  primary key (user_id, cohort_value_id)
);

create table public.user_entity_affiliations (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  affiliation_type text not null check (affiliation_type in ('favorite', 'alma_mater', 'hometown', 'conference_fan')),
  consented_at timestamptz not null default now(),
  primary key (user_id, entity_id, affiliation_type)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  visibility text not null default 'private' check (visibility in ('public', 'private', 'unlisted')),
  created_at timestamptz not null default now()
);

create table public.group_memberships (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.aggregates (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.ranking_template_versions(id),
  cycle_id uuid references public.ranking_cycles(id),
  cohort_signature text not null,
  cohort_definition jsonb not null default '{}'::jsonb,
  method_version text not null,
  eligible_ballot_count integer not null,
  suppression_status text not null default 'visible' check (suppression_status in ('visible', 'small_cohort', 'dominance', 'sensitive_combination')),
  calculated_at timestamptz not null default now(),
  unique nulls not distinct (template_version_id, cycle_id, cohort_signature, method_version)
);

create table public.aggregate_positions (
  aggregate_id uuid not null references public.aggregates(id) on delete cascade,
  entity_id uuid not null references public.entities(id),
  position integer not null,
  points double precision not null,
  average_position double precision,
  ballot_count integer not null,
  distribution jsonb not null default '{}'::jsonb,
  primary key (aggregate_id, entity_id),
  unique (aggregate_id, position)
);

create table public.source_jobs (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id),
  dataset_version_id uuid references public.dataset_versions(id),
  status text not null check (status in ('queued', 'running', 'validated', 'published', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  request_count integer not null default 0,
  rows_received integer not null default 0,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.validation_results (
  id uuid primary key default gen_random_uuid(),
  source_job_id uuid not null references public.source_jobs(id) on delete cascade,
  check_name text not null,
  status text not null check (status in ('passed', 'warning', 'failed')),
  expected_value jsonb,
  actual_value jsonb,
  message text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger entities_set_updated_at before update on public.entities
for each row execute function public.set_updated_at();
create trigger ranking_templates_set_updated_at before update on public.ranking_templates
for each row execute function public.set_updated_at();
create trigger rankings_set_updated_at before update on public.rankings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_ranked_user()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_ranked_user();

create or replace function public.user_matches_ranked_cohort(p_user_id uuid, p_filters jsonb)
returns boolean
language sql
stable
security definer set search_path = public, pg_temp
as $$
  select not exists (
    select 1
    from jsonb_each_text(coalesce(p_filters, '{}'::jsonb)) as filter(key, value)
    where case
      when filter.key = 'favorite_entity' then not exists (
        select 1 from public.user_entity_affiliations a
        where a.user_id = p_user_id
          and a.affiliation_type = 'favorite'
          and a.entity_id::text = filter.value
      )
      when filter.key = 'group' then not exists (
        select 1 from public.group_memberships gm
        where gm.user_id = p_user_id and gm.group_id::text = filter.value
      )
      else not exists (
        select 1
        from public.user_cohort_values ucv
        join public.cohort_values cv on cv.id = ucv.cohort_value_id
        join public.cohort_dimensions cd on cd.id = cv.dimension_id
        where ucv.user_id = p_user_id
          and cd.slug = filter.key
          and cv.slug = filter.value
      )
    end
  );
$$;

create or replace function public.is_ranked_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.group_memberships gm
    where gm.group_id = p_group_id and gm.user_id = p_user_id
  );
$$;

create or replace function public.get_cohort_consensus(
  p_template_version_id uuid,
  p_cycle_id uuid,
  p_filters jsonb,
  p_min_cohort integer default 25
)
returns jsonb
language sql
stable
security definer set search_path = public, pg_temp
as $$
  with eligible as (
    select distinct on (r.author_id)
      r.id, r.author_id, tv.max_length
    from public.rankings r
    join public.ranking_template_versions tv on tv.id = r.template_version_id
    where r.template_version_id = p_template_version_id
      and r.cycle_id is not distinct from p_cycle_id
      and r.status = 'published'
      and r.visibility in ('public', 'unlisted')
      and r.author_id is not null
      and public.user_matches_ranked_cohort(r.author_id, p_filters)
    order by r.author_id, r.published_at desc, r.id desc
  ), sample as (
    select count(*)::integer as size from eligible
  ), scored as (
    select rp.entity_id,
      sum(e.max_length - rp.position + 1)::double precision as points,
      avg(rp.position)::double precision as average_position,
      count(*)::integer as ballot_count
    from eligible e
    join public.ranking_placements rp on rp.ranking_id = e.id
    group by rp.entity_id
  ), ordered as (
    select s.*,
      dense_rank() over (order by s.points desc, s.average_position asc, s.entity_id)::integer as position
    from scored s
  )
  select case
    when sample.size < greatest(p_min_cohort, 25) then jsonb_build_object(
      'suppressed', true,
      'reason', 'small_cohort',
      'minimumCohort', greatest(p_min_cohort, 25),
      'sampleSize', null,
      'positions', '[]'::jsonb,
      'cohort', coalesce(p_filters, '{}'::jsonb),
      'methodVersion', 'ap-points-v1'
    )
    else jsonb_build_object(
      'suppressed', false,
      'sampleSize', sample.size,
      'positions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'entityId', o.entity_id,
          'position', o.position,
          'points', o.points,
          'averagePosition', round(o.average_position::numeric, 2),
          'ballotCount', o.ballot_count
        ) order by o.position, o.entity_id)
        from ordered o
      ), '[]'::jsonb),
      'cohort', coalesce(p_filters, '{}'::jsonb),
      'methodVersion', 'ap-points-v1'
    )
  end
  from sample;
$$;

create or replace function public.get_ranking_affinity(
  p_anchor_template_version_id uuid,
  p_anchor_cycle_id uuid,
  p_anchor_entity_id uuid,
  p_anchor_max_position integer,
  p_compare_template_version_id uuid,
  p_compare_cycle_id uuid,
  p_filters jsonb,
  p_min_cohort integer default 25
)
returns jsonb
language sql
stable
security definer set search_path = public, pg_temp
as $$
  with latest_anchor as (
    select distinct on (r.author_id) r.id, r.author_id
    from public.rankings r
    where r.template_version_id = p_anchor_template_version_id
      and r.cycle_id is not distinct from p_anchor_cycle_id
      and r.status = 'published'
      and r.visibility in ('public', 'unlisted')
      and r.author_id is not null
      and public.user_matches_ranked_cohort(r.author_id, p_filters)
    order by r.author_id, r.published_at desc, r.id desc
  ), anchor_users as (
    select la.author_id
    from latest_anchor la
    join public.ranking_placements rp on rp.ranking_id = la.id
    where rp.entity_id = p_anchor_entity_id and rp.position <= p_anchor_max_position
  ), anchor_sample as (
    select count(*)::integer as size from anchor_users
  ), latest_compare as (
    select distinct on (r.author_id) r.id, r.author_id
    from public.rankings r
    where r.template_version_id = p_compare_template_version_id
      and r.cycle_id is not distinct from p_compare_cycle_id
      and r.status = 'published'
      and r.visibility in ('public', 'unlisted')
      and r.author_id is not null
      and public.user_matches_ranked_cohort(r.author_id, p_filters)
    order by r.author_id, r.published_at desc, r.id desc
  ), baseline as (
    select rp.entity_id, avg(rp.position)::double precision as average_position,
      count(distinct lc.author_id)::integer as people
    from latest_compare lc
    join public.ranking_placements rp on rp.ranking_id = lc.id
    group by rp.entity_id
  ), anchor_patterns as (
    select rp.entity_id, avg(rp.position)::double precision as average_position,
      count(distinct lc.author_id)::integer as people
    from latest_compare lc
    join anchor_users au on au.author_id = lc.author_id
    join public.ranking_placements rp on rp.ranking_id = lc.id
    group by rp.entity_id
    having count(distinct lc.author_id) >= greatest(p_min_cohort, 25)
  ), demographic_baseline as (
    select cv.id as cohort_value_id, count(distinct lc.author_id)::integer as people
    from latest_compare lc
    join public.user_cohort_values ucv on ucv.user_id = lc.author_id
    join public.cohort_values cv on cv.id = ucv.cohort_value_id
    group by cv.id
  ), demographic_patterns as (
    select cd.slug as dimension, cv.slug as value, cv.label,
      count(distinct au.author_id)::integer as people,
      db.people as baseline_people,
      count(distinct au.author_id)::double precision / nullif((select size from anchor_sample), 0) as cohort_share,
      db.people::double precision / nullif((select count(*) from latest_compare), 0) as baseline_share
    from anchor_users au
    join public.user_cohort_values ucv on ucv.user_id = au.author_id
    join public.cohort_values cv on cv.id = ucv.cohort_value_id
    join public.cohort_dimensions cd on cd.id = cv.dimension_id
    join demographic_baseline db on db.cohort_value_id = cv.id
    group by cd.slug, cv.slug, cv.label, db.people
    having count(distinct au.author_id) >= greatest(p_min_cohort, 25)
       and db.people >= greatest(p_min_cohort, 25)
  )
  select case
    when anchor_sample.size < greatest(p_min_cohort, 25) then jsonb_build_object(
      'suppressed', true,
      'reason', 'small_anchor_cohort',
      'minimumCohort', greatest(p_min_cohort, 25),
      'sampleSize', null,
      'rankingPatterns', '[]'::jsonb,
      'demographicPatterns', '[]'::jsonb
    )
    else jsonb_build_object(
      'suppressed', false,
      'sampleSize', anchor_sample.size,
      'anchor', jsonb_build_object('entityId', p_anchor_entity_id, 'maxPosition', p_anchor_max_position),
      'rankingPatterns', coalesce((
        select jsonb_agg(jsonb_build_object(
          'entityId', ap.entity_id,
          'people', ap.people,
          'averagePosition', round(ap.average_position::numeric, 2),
          'baselineAveragePosition', round(b.average_position::numeric, 2),
          'positionLift', round((b.average_position - ap.average_position)::numeric, 2)
        ) order by (b.average_position - ap.average_position) desc, ap.people desc)
        from anchor_patterns ap join baseline b on b.entity_id = ap.entity_id
      ), '[]'::jsonb),
      'demographicPatterns', coalesce((
        select jsonb_agg(jsonb_build_object(
          'dimension', dp.dimension,
          'value', dp.value,
          'label', dp.label,
          'people', dp.people,
          'cohortShare', round(dp.cohort_share::numeric, 4),
          'baselineShare', round(dp.baseline_share::numeric, 4),
          'shareLift', round((dp.cohort_share - dp.baseline_share)::numeric, 4)
        ) order by (dp.cohort_share - dp.baseline_share) desc)
        from demographic_patterns dp
      ), '[]'::jsonb),
      'methodVersion', 'affinity-v1'
    )
  end
  from anchor_sample;
$$;

insert into public.domains (slug, name, description)
values ('college-football', 'College Football', 'Teams, people, places, games, culture, and every rankable college-football concept.');

insert into public.entity_types (domain_id, slug, singular_name, plural_name, description)
select d.id, seed.slug, seed.singular_name, seed.plural_name, seed.description
from public.domains d
cross join (values
  ('team', 'Team', 'Teams', 'College football teams and programs'),
  ('player', 'Player', 'Players', 'Rostered and historical players'),
  ('coach', 'Coach', 'Coaches', 'Head coaches, coordinators, and staff'),
  ('conference', 'Conference', 'Conferences', 'Current and historical conferences'),
  ('town', 'Town', 'Towns', 'College towns and host cities'),
  ('stadium', 'Stadium', 'Stadiums', 'Venues and game-day settings'),
  ('mascot', 'Mascot', 'Mascots', 'Official team mascots'),
  ('game', 'Game', 'Games', 'Scheduled and completed games'),
  ('unit', 'Unit', 'Units', 'Offenses, defenses, and position groups'),
  ('recruiting-class', 'Recruiting class', 'Recruiting classes', 'Team and position recruiting classes'),
  ('rivalry', 'Rivalry', 'Rivalries', 'Recurring matchups and rivalry series'),
  ('uniform', 'Uniform', 'Uniforms', 'Uniform combinations and visual identities'),
  ('tradition', 'Tradition', 'Traditions', 'Songs, entrances, rituals, and cultural items'),
  ('custom', 'Custom option', 'Custom options', 'User-created rankable options')
) as seed(slug, singular_name, plural_name, description)
where d.slug = 'college-football';

insert into public.data_sources (slug, name, homepage_url, rights_metadata)
values
  ('cfbd', 'CollegeFootballData', 'https://collegefootballdata.com', '{"adapter":"replaceable","redistribution":"subject-to-provider-terms"}'::jsonb),
  ('community', 'Ranked community', null, '{"moderationRequired":true}'::jsonb);

insert into public.datasets (domain_id, source_id, slug, name, description, refresh_cadence)
select d.id, s.id, 'cfbd-season', 'College football season data', 'Canonical saved season snapshots used by comparisons and ranking option pools.', 'weekly'
from public.domains d cross join public.data_sources s
where d.slug = 'college-football' and s.slug = 'cfbd';

insert into public.cohort_dimensions (slug, name, description, collection_method, sensitive, multi_select)
values
  ('geography', 'Region', 'Coarse self-selected or derived region; never precise location.', 'optional profile selection', false, false),
  ('age_band', 'Age band', 'Broad optional age range.', 'optional profile selection', true, false),
  ('experience', 'Football experience', 'How the user describes their college-football involvement.', 'optional profile selection', false, false),
  ('participation', 'Participation history', 'Behavioral segment derived from ranking activity.', 'derived', false, false);

insert into public.cohort_values (dimension_id, slug, label, sort_order)
select d.id, seed.slug, seed.label, seed.sort_order
from public.cohort_dimensions d
join (values
  ('geography', 'new-england', 'New England', 10),
  ('geography', 'mid-atlantic', 'Mid-Atlantic', 20),
  ('geography', 'south', 'South', 30),
  ('geography', 'midwest', 'Midwest', 40),
  ('geography', 'mountain-west', 'Mountain West', 50),
  ('geography', 'west-coast', 'West Coast', 60),
  ('age_band', '18-24', '18-24', 10),
  ('age_band', '25-34', '25-34', 20),
  ('age_band', '35-44', '35-44', 30),
  ('age_band', '45-54', '45-54', 40),
  ('age_band', '55-plus', '55+', 50),
  ('experience', 'casual', 'Casual fan', 10),
  ('experience', 'avid', 'Avid fan', 20),
  ('experience', 'analyst', 'Analyst or creator', 30),
  ('experience', 'coach-player-media', 'Coach, player, or media', 40),
  ('participation', 'first-time', 'First-time ranker', 10),
  ('participation', 'weekly', 'Weekly participant', 20),
  ('participation', 'long-term', 'Long-term participant', 30)
) as seed(dimension_slug, slug, label, sort_order)
  on seed.dimension_slug = d.slug;

alter table public.domains enable row level security;
alter table public.entity_types enable row level security;
alter table public.profiles enable row level security;
alter table public.entities enable row level security;
alter table public.entity_aliases enable row level security;
alter table public.entity_external_ids enable row level security;
alter table public.entity_relationships enable row level security;
alter table public.data_sources enable row level security;
alter table public.datasets enable row level security;
alter table public.dataset_versions enable row level security;
alter table public.attribute_definitions enable row level security;
alter table public.entity_attribute_values enable row level security;
alter table public.ranking_templates enable row level security;
alter table public.ranking_template_versions enable row level security;
alter table public.ranking_template_entities enable row level security;
alter table public.ranking_cycles enable row level security;
alter table public.rankings enable row level security;
alter table public.ranking_placements enable row level security;
alter table public.ranking_events enable row level security;
alter table public.cohort_dimensions enable row level security;
alter table public.cohort_values enable row level security;
alter table public.user_cohort_values enable row level security;
alter table public.user_entity_affiliations enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.aggregates enable row level security;
alter table public.aggregate_positions enable row level security;
alter table public.source_jobs enable row level security;
alter table public.validation_results enable row level security;

create policy "public catalog domains" on public.domains for select using (status = 'active');
create policy "public catalog entity types" on public.entity_types for select using (true);
create policy "public active entities" on public.entities for select using (status = 'active' and deleted_at is null);
create policy "creators manage own entities" on public.entities for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "public entity aliases" on public.entity_aliases for select using (true);
create policy "public entity external ids" on public.entity_external_ids for select using (true);
create policy "public entity relationships" on public.entity_relationships for select using (true);
create policy "public data sources" on public.data_sources for select using (true);
create policy "public datasets" on public.datasets for select using (true);
create policy "public published dataset versions" on public.dataset_versions for select using (status in ('published', 'superseded'));
create policy "public attribute definitions" on public.attribute_definitions for select using (public_visible);
create policy "public published attribute values" on public.entity_attribute_values for select using (
  exists (select 1 from public.dataset_versions dv where dv.id = dataset_version_id and dv.status in ('published', 'superseded'))
);

create policy "public profiles" on public.profiles for select using (true);
create policy "users create own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "read visible templates" on public.ranking_templates for select using (
  (status = 'active' and visibility in ('public', 'unlisted')) or created_by = auth.uid()
);
create policy "create templates" on public.ranking_templates for insert to authenticated with check (created_by = auth.uid());
create policy "manage own templates" on public.ranking_templates for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "read visible template versions" on public.ranking_template_versions for select using (
  exists (select 1 from public.ranking_templates rt where rt.id = template_id and ((rt.status = 'active' and rt.visibility in ('public', 'unlisted')) or rt.created_by = auth.uid()))
);
create policy "manage own template versions" on public.ranking_template_versions for all to authenticated using (
  exists (select 1 from public.ranking_templates rt where rt.id = template_id and rt.created_by = auth.uid())
) with check (
  exists (select 1 from public.ranking_templates rt where rt.id = template_id and rt.created_by = auth.uid())
);
create policy "read visible template entities" on public.ranking_template_entities for select using (
  exists (select 1 from public.ranking_template_versions tv join public.ranking_templates rt on rt.id = tv.template_id where tv.id = template_version_id and ((rt.status = 'active' and rt.visibility in ('public', 'unlisted')) or rt.created_by = auth.uid()))
);
create policy "manage own template entities" on public.ranking_template_entities for all to authenticated using (
  exists (select 1 from public.ranking_template_versions tv join public.ranking_templates rt on rt.id = tv.template_id where tv.id = template_version_id and rt.created_by = auth.uid())
) with check (
  exists (select 1 from public.ranking_template_versions tv join public.ranking_templates rt on rt.id = tv.template_id where tv.id = template_version_id and rt.created_by = auth.uid())
);
create policy "read ranking cycles" on public.ranking_cycles for select using (true);

create policy "read published or own rankings" on public.rankings for select using (
  (status = 'published' and visibility in ('public', 'unlisted')) or author_id = auth.uid()
);
create policy "create own rankings" on public.rankings for insert to authenticated with check (author_id = auth.uid() and status = 'draft');
create policy "update own draft or publish" on public.rankings for update to authenticated
  using (author_id = auth.uid() and status = 'draft')
  with check (author_id = auth.uid() and status in ('draft', 'published'));
create policy "delete own drafts" on public.rankings for delete to authenticated using (author_id = auth.uid() and status = 'draft');
create policy "read placements for visible rankings" on public.ranking_placements for select using (
  exists (select 1 from public.rankings r where r.id = ranking_id and ((r.status = 'published' and r.visibility in ('public', 'unlisted')) or r.author_id = auth.uid()))
);
create policy "manage placements in own drafts" on public.ranking_placements for all to authenticated using (
  exists (select 1 from public.rankings r where r.id = ranking_id and r.author_id = auth.uid() and r.status = 'draft')
) with check (
  exists (select 1 from public.rankings r where r.id = ranking_id and r.author_id = auth.uid() and r.status = 'draft')
);
create policy "read own ranking events" on public.ranking_events for select to authenticated using (
  exists (select 1 from public.rankings r where r.id = ranking_id and r.author_id = auth.uid())
);
create policy "append own ranking events" on public.ranking_events for insert to authenticated with check (
  actor_id = auth.uid() and exists (select 1 from public.rankings r where r.id = ranking_id and r.author_id = auth.uid())
);

create policy "public cohort taxonomy" on public.cohort_dimensions for select using (status = 'active');
create policy "public cohort values" on public.cohort_values for select using (true);
create policy "users read own cohorts" on public.user_cohort_values for select to authenticated using (user_id = auth.uid());
create policy "users manage own cohorts" on public.user_cohort_values for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read own affiliations" on public.user_entity_affiliations for select to authenticated using (user_id = auth.uid());
create policy "users manage own affiliations" on public.user_entity_affiliations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read public or joined groups" on public.groups for select using (
  visibility in ('public', 'unlisted') or owner_id = auth.uid() or public.is_ranked_group_member(id, auth.uid())
);
create policy "create groups" on public.groups for insert to authenticated with check (owner_id = auth.uid());
create policy "owners manage groups" on public.groups for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "read group memberships" on public.group_memberships for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
);
create policy "group owners manage memberships" on public.group_memberships for all to authenticated using (
  exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
) with check (
  exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
);

create policy "read visible aggregates" on public.aggregates for select using (suppression_status = 'visible');
create policy "read visible aggregate positions" on public.aggregate_positions for select using (
  exists (select 1 from public.aggregates a where a.id = aggregate_id and a.suppression_status = 'visible')
);

revoke all on public.user_cohort_values from anon;
revoke all on public.user_entity_affiliations from anon;
revoke all on public.source_jobs from anon, authenticated;
revoke all on public.validation_results from anon, authenticated;

grant select on public.domains, public.entity_types, public.entities, public.entity_aliases,
  public.entity_external_ids, public.entity_relationships, public.data_sources, public.datasets,
  public.dataset_versions, public.attribute_definitions, public.entity_attribute_values,
  public.ranking_templates, public.ranking_template_versions, public.ranking_template_entities,
  public.ranking_cycles, public.rankings, public.ranking_placements, public.cohort_dimensions,
  public.cohort_values, public.aggregates, public.aggregate_positions, public.profiles
to anon, authenticated;

grant insert, update, delete on public.entities, public.ranking_templates, public.ranking_template_versions,
  public.ranking_template_entities, public.rankings, public.ranking_placements, public.profiles,
  public.user_cohort_values, public.user_entity_affiliations, public.groups, public.group_memberships
to authenticated;
grant select on public.user_cohort_values, public.user_entity_affiliations, public.groups,
  public.group_memberships, public.ranking_events to authenticated;
grant insert on public.ranking_events to authenticated;
grant usage, select on sequence public.ranking_events_id_seq to authenticated;

revoke execute on function public.user_matches_ranked_cohort(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.is_ranked_group_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_cohort_consensus(uuid, uuid, jsonb, integer) to anon, authenticated;
grant execute on function public.get_ranking_affinity(uuid, uuid, uuid, integer, uuid, uuid, jsonb, integer) to anon, authenticated;

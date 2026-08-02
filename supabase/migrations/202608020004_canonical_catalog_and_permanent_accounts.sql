-- Canonical option pools and permanent-account publishing.
-- This migration deliberately removes the old user-created entity path: community
-- questions are flexible, but every eligible answer must already exist in the catalog.

insert into public.entity_types (domain_id, slug, singular_name, plural_name, description, presentation_schema)
select d.id, seed.slug, seed.singular_name, seed.plural_name, seed.description, '{"rankable":true,"source":"cfbd"}'::jsonb
from public.domains d
cross join (values
  ('recruit', 'Recruit', 'Recruits', 'High-school and junior-college recruits'),
  ('transfer', 'Transfer', 'Transfers', 'Transfer portal entries and destinations'),
  ('team-season', 'Team season', 'Team seasons', 'A program in one specific season'),
  ('draft-pick', 'NFL draft pick', 'NFL draft picks', 'College players selected in the NFL Draft')
) as seed(slug, singular_name, plural_name, description)
where d.slug = 'college-football'
on conflict (domain_id, slug) do update set
  singular_name = excluded.singular_name,
  plural_name = excluded.plural_name,
  description = excluded.description,
  presentation_schema = excluded.presentation_schema;

update public.entity_types
set presentation_schema = jsonb_build_object(
  'rankable', slug in ('team','player','coach','conference','game','stadium','town','mascot','recruiting-class','recruit','transfer','unit','team-season','draft-pick'),
  'source', case when slug = 'custom' then 'disabled' else 'cfbd' end
)
where domain_id = (select id from public.domains where slug = 'college-football');

drop policy if exists "creators manage own entities" on public.entities;
revoke insert, update, delete on public.entities from authenticated;

create unique index if not exists entity_attribute_values_version_entity_definition_uidx
  on public.entity_attribute_values (dataset_version_id, entity_id, attribute_definition_id);

create or replace function public.is_permanent_ranked_user()
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

revoke execute on function public.is_permanent_ranked_user() from public, anon;
grant execute on function public.is_permanent_ranked_user() to authenticated, service_role;

drop policy if exists "create templates" on public.ranking_templates;
create policy "permanent users create templates" on public.ranking_templates for insert to authenticated
  with check (created_by = auth.uid() and public.is_permanent_ranked_user());
drop policy if exists "manage own templates" on public.ranking_templates;
create policy "permanent users manage own templates" on public.ranking_templates for update to authenticated
  using (created_by = auth.uid() and public.is_permanent_ranked_user())
  with check (created_by = auth.uid() and public.is_permanent_ranked_user());

drop policy if exists "manage own template versions" on public.ranking_template_versions;
create policy "permanent users manage own template versions" on public.ranking_template_versions for all to authenticated
  using (public.is_permanent_ranked_user() and exists (
    select 1 from public.ranking_templates rt where rt.id = template_id and rt.created_by = auth.uid()
  ))
  with check (public.is_permanent_ranked_user() and exists (
    select 1 from public.ranking_templates rt where rt.id = template_id and rt.created_by = auth.uid()
  ));

drop policy if exists "manage own template entities" on public.ranking_template_entities;
create policy "permanent users manage own template entities" on public.ranking_template_entities for all to authenticated
  using (public.is_permanent_ranked_user() and exists (
    select 1 from public.ranking_template_versions tv
    join public.ranking_templates rt on rt.id = tv.template_id
    where tv.id = template_version_id and rt.created_by = auth.uid()
  ))
  with check (public.is_permanent_ranked_user() and exists (
    select 1 from public.ranking_template_versions tv
    join public.ranking_templates rt on rt.id = tv.template_id
    where tv.id = template_version_id and rt.created_by = auth.uid()
  ));

drop policy if exists "create own rankings" on public.rankings;
create policy "permanent users create rankings" on public.rankings for insert to authenticated
  with check (author_id = auth.uid() and status = 'draft' and public.is_permanent_ranked_user());
drop policy if exists "update own draft or publish" on public.rankings;
create policy "permanent users update own rankings" on public.rankings for update to authenticated
  using (author_id = auth.uid() and status = 'draft' and public.is_permanent_ranked_user())
  with check (author_id = auth.uid() and status in ('draft', 'published') and public.is_permanent_ranked_user());

drop policy if exists "users manage own cohorts" on public.user_cohort_values;
create policy "permanent users manage own cohorts" on public.user_cohort_values for all to authenticated
  using (user_id = auth.uid() and public.is_permanent_ranked_user())
  with check (user_id = auth.uid() and public.is_permanent_ranked_user());

create or replace function public.create_my_ranking_template(
  p_template_id uuid,
  p_title text,
  p_description text,
  p_visibility text,
  p_entity_type_slug text,
  p_ranking_method text,
  p_length integer,
  p_eligibility_query jsonb,
  p_display_config jsonb,
  p_entity_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_domain_id uuid;
  v_entity_type_id uuid;
  v_template_version_id uuid;
  v_slug text;
  v_valid_entity_count integer;
begin
  if not public.is_permanent_ranked_user() then
    raise exception 'A permanent account is required to publish';
  end if;
  if p_title is null or length(trim(p_title)) < 2 then raise exception 'A poll title is required'; end if;
  if p_length not between 2 and 50 then raise exception 'Poll length must be between 2 and 50'; end if;
  if p_visibility not in ('public', 'unlisted', 'private') then raise exception 'Invalid poll visibility'; end if;
  if p_ranking_method not in ('manual', 'pairwise', 'scoring', 'tier') then raise exception 'Invalid ranking method'; end if;
  if cardinality(coalesce(p_entity_ids, '{}'::uuid[])) < p_length then raise exception 'The canonical option pool is smaller than the poll length'; end if;

  select d.id, et.id into v_domain_id, v_entity_type_id
  from public.domains d join public.entity_types et on et.domain_id = d.id
  where d.slug = 'college-football' and et.slug = p_entity_type_slug
    and coalesce((et.presentation_schema ->> 'rankable')::boolean, false);
  if v_domain_id is null or v_entity_type_id is null then raise exception 'Unknown or non-rankable entity type: %', p_entity_type_slug; end if;

  select count(distinct e.id)::integer into v_valid_entity_count
  from public.entities e
  where e.id = any(coalesce(p_entity_ids, '{}'::uuid[]))
    and e.domain_id = v_domain_id and e.entity_type_id = v_entity_type_id
    and e.status = 'active' and e.deleted_at is null;
  if v_valid_entity_count <> cardinality(coalesce(p_entity_ids, '{}'::uuid[])) then
    raise exception 'Every option must be a unique, active canonical entity of type %', p_entity_type_slug;
  end if;

  v_slug := 'community-' || replace(p_template_id::text, '-', '');
  insert into public.ranking_templates (id, domain_id, slug, title, description, created_by, visibility, template_kind, status)
  values (p_template_id, v_domain_id, v_slug, trim(p_title), nullif(trim(p_description), ''), v_user_id, p_visibility, 'community', 'active');
  insert into public.ranking_template_versions (
    template_id, version, entity_type_id, ranking_method, min_length, max_length,
    default_length, exact_length, eligibility_query, display_config, aggregate_eligible
  ) values (
    p_template_id, 1, v_entity_type_id, p_ranking_method, p_length, p_length,
    p_length, true, coalesce(p_eligibility_query, '{}'::jsonb), coalesce(p_display_config, '{}'::jsonb), p_visibility = 'public'
  ) returning id into v_template_version_id;
  insert into public.ranking_template_entities (template_version_id, entity_id, seed_order)
  select v_template_version_id, entity_id, ordinal::integer
  from unnest(p_entity_ids) with ordinality as option(entity_id, ordinal);
  return jsonb_build_object('templateId', p_template_id, 'templateVersionId', v_template_version_id, 'createdBy', v_user_id);
end;
$$;

create or replace function public.save_my_ranking_draft(
  p_template_version_id uuid,
  p_dataset_version_id uuid,
  p_title text,
  p_note text,
  p_visibility text,
  p_entity_ids uuid[],
  p_existing_ranking_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_ranking_id uuid;
  v_entity_type_id uuid;
  v_max_length integer;
  v_unique_count integer;
  v_valid_count integer;
  v_pool_count integer;
begin
  if not public.is_permanent_ranked_user() then raise exception 'A permanent account is required to save a relational ballot'; end if;
  if p_visibility not in ('public', 'unlisted', 'private') then raise exception 'Invalid ranking visibility'; end if;
  select entity_type_id, max_length into v_entity_type_id, v_max_length from public.ranking_template_versions where id = p_template_version_id;
  if v_max_length is null then raise exception 'Unknown ranking template version'; end if;
  if cardinality(coalesce(p_entity_ids, '{}'::uuid[])) > v_max_length then raise exception 'Ranking has too many placements'; end if;
  select count(distinct entity_id)::integer into v_unique_count from unnest(coalesce(p_entity_ids, '{}'::uuid[])) as entity_id;
  if v_unique_count <> cardinality(coalesce(p_entity_ids, '{}'::uuid[])) then raise exception 'Ranking contains duplicate entities'; end if;
  select count(*)::integer into v_valid_count from public.entities e
  where e.id = any(coalesce(p_entity_ids, '{}'::uuid[])) and e.entity_type_id = v_entity_type_id and e.status = 'active' and e.deleted_at is null;
  if v_valid_count <> cardinality(coalesce(p_entity_ids, '{}'::uuid[])) then raise exception 'Ranking contains an invalid or wrong-type entity'; end if;
  select count(*)::integer into v_pool_count from public.ranking_template_entities where template_version_id = p_template_version_id;
  if v_pool_count > 0 and exists (
    select 1 from unnest(coalesce(p_entity_ids, '{}'::uuid[])) option(entity_id)
    where not exists (select 1 from public.ranking_template_entities rte where rte.template_version_id = p_template_version_id and rte.entity_id = option.entity_id)
  ) then raise exception 'Ranking contains an entity outside the saved eligibility pool'; end if;

  if p_existing_ranking_id is not null then
    select id into v_ranking_id from public.rankings
    where id = p_existing_ranking_id and author_id = v_user_id and template_version_id = p_template_version_id and status = 'draft' for update;
  end if;
  if v_ranking_id is null then
    insert into public.rankings (template_version_id, dataset_version_id, author_id, status, visibility, title, note)
    values (p_template_version_id, p_dataset_version_id, v_user_id, 'draft', p_visibility, nullif(trim(p_title), ''), nullif(trim(p_note), ''))
    returning id into v_ranking_id;
  else
    update public.rankings set dataset_version_id = p_dataset_version_id, visibility = p_visibility,
      title = nullif(trim(p_title), ''), note = nullif(trim(p_note), ''), revision = revision + 1 where id = v_ranking_id;
    delete from public.ranking_placements where ranking_id = v_ranking_id;
  end if;
  insert into public.ranking_placements (ranking_id, entity_id, position)
  select v_ranking_id, entity_id, ordinal::integer from unnest(coalesce(p_entity_ids, '{}'::uuid[])) with ordinality as placement(entity_id, ordinal);
  insert into public.ranking_events (ranking_id, actor_id, event_type, payload)
  values (v_ranking_id, v_user_id, 'draft_saved', jsonb_build_object('placementCount', cardinality(coalesce(p_entity_ids, '{}'::uuid[]))));
  return v_ranking_id;
end;
$$;

create or replace function public.publish_my_ranking(p_ranking_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_required_length integer;
  v_exact_length boolean;
  v_placement_count integer;
  v_published_at timestamptz := now();
begin
  if not public.is_permanent_ranked_user() then raise exception 'A permanent account is required to publish'; end if;
  select tv.default_length, tv.exact_length into v_required_length, v_exact_length
  from public.rankings r join public.ranking_template_versions tv on tv.id = r.template_version_id
  where r.id = p_ranking_id and r.author_id = v_user_id and r.status = 'draft' for update of r;
  if v_required_length is null then raise exception 'Draft not found'; end if;
  select count(*)::integer into v_placement_count from public.ranking_placements where ranking_id = p_ranking_id;
  if v_exact_length and v_placement_count <> v_required_length then raise exception 'Complete all % ranking positions before publishing', v_required_length; end if;
  update public.rankings set status = 'published', published_at = v_published_at, revision = revision + 1 where id = p_ranking_id;
  insert into public.ranking_events (ranking_id, actor_id, event_type, payload)
  values (p_ranking_id, v_user_id, 'published', jsonb_build_object('placementCount', v_placement_count));
  return jsonb_build_object('rankingId', p_ranking_id, 'publishedAt', v_published_at, 'placementCount', v_placement_count);
end;
$$;

insert into public.ranking_templates (id, domain_id, slug, title, description, visibility, template_kind, status)
select seed.id, d.id, seed.slug, seed.title, seed.description, 'public', 'official', 'active'
from public.domains d
cross join (values
  ('00000000-0000-4000-8000-000000000025'::uuid, 'official-top-25', 'Your College Football Top 25', 'Rank the teams you believe are best right now.'),
  ('00000000-0000-4000-8000-000000000010'::uuid, 'official-stadiums', 'Best College Football Stadiums', 'Rank the best venues in college football.')
) as seed(id, slug, title, description)
where d.slug = 'college-football'
on conflict (id) do update set title = excluded.title, description = excluded.description, status = 'active';

insert into public.ranking_template_versions (
  id, template_id, version, entity_type_id, ranking_method, min_length, max_length,
  default_length, exact_length, eligibility_query, display_config, aggregate_eligible
)
select seed.version_id, seed.template_id, 1, et.id, 'manual', seed.length, seed.length,
  seed.length, true, seed.eligibility, seed.display_config, true
from public.domains d
cross join (values
  ('00000000-0000-4000-8001-000000000025'::uuid, '00000000-0000-4000-8000-000000000025'::uuid, 'team', 25, '{"subject":"teams"}'::jsonb, '{"accent":"#f4b942"}'::jsonb),
  ('00000000-0000-4000-8001-000000000010'::uuid, '00000000-0000-4000-8000-000000000010'::uuid, 'stadium', 10, '{"subject":"stadiums"}'::jsonb, '{"accent":"#72d5c8"}'::jsonb)
) as seed(version_id, template_id, entity_type_slug, length, eligibility, display_config)
join public.entity_types et on et.domain_id = d.id and et.slug = seed.entity_type_slug
where d.slug = 'college-football'
on conflict (id) do update set eligibility_query = excluded.eligibility_query, display_config = excluded.display_config;

revoke execute on function public.create_my_ranking_template(uuid, text, text, text, text, text, integer, jsonb, jsonb, uuid[]) from public, anon;
revoke execute on function public.save_my_ranking_draft(uuid, uuid, text, text, text, uuid[], uuid) from public, anon;
revoke execute on function public.publish_my_ranking(uuid) from public, anon;
grant execute on function public.create_my_ranking_template(uuid, text, text, text, text, text, integer, jsonb, jsonb, uuid[]) to authenticated;
grant execute on function public.save_my_ranking_draft(uuid, uuid, text, text, text, uuid[], uuid) to authenticated;
grant execute on function public.publish_my_ranking(uuid) to authenticated;

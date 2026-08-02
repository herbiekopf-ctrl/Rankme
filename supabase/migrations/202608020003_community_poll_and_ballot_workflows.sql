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
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if p_title is null or length(trim(p_title)) < 2 then
    raise exception 'A poll title is required';
  end if;
  if p_length not between 2 and 50 then
    raise exception 'Poll length must be between 2 and 50';
  end if;
  if p_visibility not in ('public', 'unlisted', 'private') then
    raise exception 'Invalid poll visibility';
  end if;
  if p_ranking_method not in ('manual', 'pairwise', 'scoring', 'tier') then
    raise exception 'Invalid ranking method';
  end if;

  select d.id, et.id into v_domain_id, v_entity_type_id
  from public.domains d
  join public.entity_types et on et.domain_id = d.id
  where d.slug = 'college-football' and et.slug = p_entity_type_slug;
  if v_domain_id is null or v_entity_type_id is null then
    raise exception 'Unknown entity type: %', p_entity_type_slug;
  end if;

  v_slug := 'community-' || replace(p_template_id::text, '-', '');
  insert into public.ranking_templates (
    id, domain_id, slug, title, description, created_by, visibility, template_kind, status
  ) values (
    p_template_id, v_domain_id, v_slug, trim(p_title), nullif(trim(p_description), ''),
    v_user_id, p_visibility, 'community', 'active'
  );

  insert into public.ranking_template_versions (
    template_id, version, entity_type_id, ranking_method, min_length, max_length,
    default_length, exact_length, eligibility_query, display_config, aggregate_eligible
  ) values (
    p_template_id, 1, v_entity_type_id, p_ranking_method, p_length, p_length,
    p_length, true, coalesce(p_eligibility_query, '{}'::jsonb),
    coalesce(p_display_config, '{}'::jsonb), p_visibility = 'public'
  ) returning id into v_template_version_id;

  if cardinality(p_entity_ids) > 0 then
    if cardinality(p_entity_ids) < p_length then
      raise exception 'The option pool is smaller than the poll length';
    end if;
    insert into public.ranking_template_entities (template_version_id, entity_id, seed_order)
    select v_template_version_id, entity_id, ordinal::integer
    from unnest(p_entity_ids) with ordinality as option(entity_id, ordinal);
  end if;

  return jsonb_build_object(
    'templateId', p_template_id,
    'templateVersionId', v_template_version_id,
    'createdBy', v_user_id
  );
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
  v_max_length integer;
  v_unique_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if p_visibility not in ('public', 'unlisted', 'private') then
    raise exception 'Invalid ranking visibility';
  end if;
  select max_length into v_max_length
  from public.ranking_template_versions
  where id = p_template_version_id;
  if v_max_length is null then
    raise exception 'Unknown ranking template version';
  end if;
  if cardinality(coalesce(p_entity_ids, '{}'::uuid[])) > v_max_length then
    raise exception 'Ranking has too many placements';
  end if;
  select count(distinct entity_id)::integer into v_unique_count
  from unnest(coalesce(p_entity_ids, '{}'::uuid[])) as entity_id;
  if v_unique_count <> cardinality(coalesce(p_entity_ids, '{}'::uuid[])) then
    raise exception 'Ranking contains duplicate entities';
  end if;

  if p_existing_ranking_id is not null then
    select id into v_ranking_id
    from public.rankings
    where id = p_existing_ranking_id
      and author_id = v_user_id
      and template_version_id = p_template_version_id
      and status = 'draft'
    for update;
  end if;

  if v_ranking_id is null then
    insert into public.rankings (
      template_version_id, dataset_version_id, author_id, status, visibility, title, note
    ) values (
      p_template_version_id, p_dataset_version_id, v_user_id, 'draft', p_visibility,
      nullif(trim(p_title), ''), nullif(trim(p_note), '')
    ) returning id into v_ranking_id;
  else
    update public.rankings
    set dataset_version_id = p_dataset_version_id,
        visibility = p_visibility,
        title = nullif(trim(p_title), ''),
        note = nullif(trim(p_note), ''),
        revision = revision + 1
    where id = v_ranking_id;
    delete from public.ranking_placements where ranking_id = v_ranking_id;
  end if;

  insert into public.ranking_placements (ranking_id, entity_id, position)
  select v_ranking_id, entity_id, ordinal::integer
  from unnest(coalesce(p_entity_ids, '{}'::uuid[])) with ordinality as placement(entity_id, ordinal);

  insert into public.ranking_events (ranking_id, actor_id, event_type, payload)
  values (
    v_ranking_id, v_user_id, 'draft_saved',
    jsonb_build_object('placementCount', cardinality(coalesce(p_entity_ids, '{}'::uuid[])))
  );
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
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  select tv.default_length, tv.exact_length
    into v_required_length, v_exact_length
  from public.rankings r
  join public.ranking_template_versions tv on tv.id = r.template_version_id
  where r.id = p_ranking_id and r.author_id = v_user_id and r.status = 'draft'
  for update of r;
  if v_required_length is null then
    raise exception 'Draft not found';
  end if;
  select count(*)::integer into v_placement_count
  from public.ranking_placements where ranking_id = p_ranking_id;
  if v_exact_length and v_placement_count <> v_required_length then
    raise exception 'Complete all % ranking positions before publishing', v_required_length;
  end if;

  update public.rankings
  set status = 'published', published_at = v_published_at, revision = revision + 1
  where id = p_ranking_id;
  insert into public.ranking_events (ranking_id, actor_id, event_type, payload)
  values (p_ranking_id, v_user_id, 'published', jsonb_build_object('placementCount', v_placement_count));

  return jsonb_build_object(
    'rankingId', p_ranking_id,
    'publishedAt', v_published_at,
    'placementCount', v_placement_count
  );
end;
$$;

revoke execute on function public.create_my_ranking_template(uuid, text, text, text, text, text, integer, jsonb, jsonb, uuid[]) from public, anon;
revoke execute on function public.save_my_ranking_draft(uuid, uuid, text, text, text, uuid[], uuid) from public, anon;
revoke execute on function public.publish_my_ranking(uuid) from public, anon;
grant execute on function public.create_my_ranking_template(uuid, text, text, text, text, text, integer, jsonb, jsonb, uuid[]) to authenticated;
grant execute on function public.save_my_ranking_draft(uuid, uuid, text, text, text, uuid[], uuid) to authenticated;
grant execute on function public.publish_my_ranking(uuid) to authenticated;

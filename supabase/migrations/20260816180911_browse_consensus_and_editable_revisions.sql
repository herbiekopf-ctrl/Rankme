-- Make community consensus a first-class browse experience and allow a voter
-- to revise the one response attached to an open period. Published revisions
-- replace the active vote atomically while the prior order stays in the
-- private ranking event log.

create or replace function public.user_matches_ranked_cohort(p_user_id uuid, p_filters jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from jsonb_each_text(coalesce(p_filters, '{}'::jsonb)) as filter(key, value)
    where case
      when filter.key in ('favorite_entity', 'team_affiliation') then not exists (
        select 1
        from public.user_entity_affiliations a
        where a.user_id = p_user_id
          and a.affiliation_type = 'favorite'
          and a.entity_id::text = filter.value
      )
      when filter.key = 'conference_affiliation' then not exists (
        select 1
        from public.user_entity_affiliations a
        where a.user_id = p_user_id
          and a.affiliation_type = 'conference_fan'
          and a.entity_id::text = filter.value
      )
      when filter.key = 'group' then not exists (
        select 1
        from public.group_memberships gm
        where gm.user_id = p_user_id
          and gm.group_id::text = filter.value
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

revoke all on function public.user_matches_ranked_cohort(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.user_matches_ranked_cohort(uuid, jsonb) to service_role;

create or replace function public.get_browse_poll_consensus(
  p_targets jsonb,
  p_filters jsonb default '{}'::jsonb,
  p_min_cohort integer default 5
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with target_input as (
    select distinct input.template_version_id, input.cycle_id
    from jsonb_to_recordset(
      case when jsonb_typeof(p_targets) = 'array' then p_targets else '[]'::jsonb end
    ) as input(template_version_id uuid, cycle_id uuid)
    where input.template_version_id is not null
      and input.cycle_id is not null
  ), targets as (
    select input.template_version_id,
           input.cycle_id,
           tv.default_length
    from target_input input
    join public.ranking_template_versions tv on tv.id = input.template_version_id
    join public.ranking_templates rt on rt.id = tv.template_id
    join public.ranking_cycles rc
      on rc.id = input.cycle_id
     and rc.template_id = tv.template_id
    where rt.status = 'active'
      and rt.visibility in ('public', 'unlisted')
  ), all_eligible as (
    select distinct on (targets.template_version_id, targets.cycle_id, r.author_id)
           targets.template_version_id,
           targets.cycle_id,
           targets.default_length,
           r.id as ranking_id,
           r.author_id,
           r.published_at
    from targets
    join public.rankings r
      on r.template_version_id = targets.template_version_id
     and r.cycle_id = targets.cycle_id
    where r.status = 'published'
      and r.visibility in ('public', 'unlisted')
      and r.author_id is not null
    order by targets.template_version_id,
             targets.cycle_id,
             r.author_id,
             r.published_at desc,
             r.id desc
  ), all_samples as (
    select template_version_id,
           cycle_id,
           count(*)::integer as voter_count,
           max(published_at) as last_response_at
    from all_eligible
    group by template_version_id, cycle_id
  ), filtered_eligible as (
    select eligible.*
    from all_eligible eligible
    where coalesce(p_filters, '{}'::jsonb) = '{}'::jsonb
       or public.user_matches_ranked_cohort(eligible.author_id, p_filters)
  ), filtered_samples as (
    select template_version_id,
           cycle_id,
           count(*)::integer as voter_count
    from filtered_eligible
    group by template_version_id, cycle_id
  ), scored as (
    select eligible.template_version_id,
           eligible.cycle_id,
           rp.entity_id,
           sum(greatest(eligible.default_length - rp.position + 1, 1))::double precision as points,
           avg(rp.position)::double precision as average_position,
           count(*)::integer as ballot_count
    from filtered_eligible eligible
    join public.ranking_placements rp on rp.ranking_id = eligible.ranking_id
    group by eligible.template_version_id, eligible.cycle_id, rp.entity_id
  ), positioned as (
    select scored.*,
           row_number() over (
             partition by scored.template_version_id, scored.cycle_id
             order by scored.points desc, scored.average_position asc, scored.entity_id
           )::integer as position
    from scored
  ), consensus_positions as (
    select positioned.template_version_id,
           positioned.cycle_id,
           jsonb_agg(
             jsonb_build_object(
               'entityId', entities.id,
               'canonicalKey', entities.canonical_key,
               'name', entities.name,
               'imageUrl', entities.image_url,
               'color', entities.color,
               'position', positioned.position,
               'points', positioned.points,
               'averagePosition', round(positioned.average_position::numeric, 2),
               'ballotCount', positioned.ballot_count
             )
             order by positioned.position, entities.id
           ) as positions
    from positioned
    join public.entities entities on entities.id = positioned.entity_id
    group by positioned.template_version_id, positioned.cycle_id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'templateVersionId', targets.template_version_id,
      'cycleId', targets.cycle_id,
      'totalVoterCount', coalesce(all_samples.voter_count, 0),
      'selectedVoterCount', case
        when coalesce(p_filters, '{}'::jsonb) <> '{}'::jsonb
         and coalesce(filtered_samples.voter_count, 0) < greatest(coalesce(p_min_cohort, 5), 5)
          then null
        else coalesce(filtered_samples.voter_count, 0)
      end,
      'lastResponseAt', all_samples.last_response_at,
      'suppressed', (
        coalesce(p_filters, '{}'::jsonb) <> '{}'::jsonb
        and coalesce(filtered_samples.voter_count, 0) < greatest(coalesce(p_min_cohort, 5), 5)
      ),
      'minimumCohort', case
        when coalesce(p_filters, '{}'::jsonb) = '{}'::jsonb then 1
        else greatest(coalesce(p_min_cohort, 5), 5)
      end,
      'positions', case
        when coalesce(p_filters, '{}'::jsonb) <> '{}'::jsonb
         and coalesce(filtered_samples.voter_count, 0) < greatest(coalesce(p_min_cohort, 5), 5)
          then '[]'::jsonb
        else coalesce(consensus_positions.positions, '[]'::jsonb)
      end,
      'methodVersion', 'ranked-points-v2'
    ) order by targets.template_version_id, targets.cycle_id
  ), '[]'::jsonb)
  from targets
  left join all_samples
    on all_samples.template_version_id = targets.template_version_id
   and all_samples.cycle_id = targets.cycle_id
  left join filtered_samples
    on filtered_samples.template_version_id = targets.template_version_id
   and filtered_samples.cycle_id = targets.cycle_id
  left join consensus_positions
    on consensus_positions.template_version_id = targets.template_version_id
   and consensus_positions.cycle_id = targets.cycle_id;
$$;

revoke all on function public.get_browse_poll_consensus(jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.get_browse_poll_consensus(jsonb, jsonb, integer) to service_role;

drop policy if exists "permanent users update own rankings" on public.rankings;
create policy "permanent users update own rankings"
on public.rankings
for update
to authenticated
using (
  author_id = (select auth.uid())
  and status in ('draft', 'published')
  and (select public.is_permanent_ranked_user())
  and exists (
    select 1
    from public.ranking_cycles rc
    where rc.id = rankings.cycle_id
      and rc.status = 'open'
      and (rc.opens_at is null or rc.opens_at <= now())
      and (rc.closes_at is null or now() < rc.closes_at)
  )
)
with check (
  author_id = (select auth.uid())
  and status in ('draft', 'published')
  and (select public.is_permanent_ranked_user())
  and exists (
    select 1
    from public.ranking_cycles rc
    where rc.id = rankings.cycle_id
      and rc.status = 'open'
      and (rc.opens_at is null or rc.opens_at <= now())
      and (rc.closes_at is null or now() < rc.closes_at)
  )
);

drop policy if exists "delete placements in own drafts" on public.ranking_placements;
drop policy if exists "insert placements in own drafts" on public.ranking_placements;
drop policy if exists "update placements in own drafts" on public.ranking_placements;

create policy "delete placements in own open responses"
on public.ranking_placements
for delete
to authenticated
using (
  exists (
    select 1
    from public.rankings r
    join public.ranking_cycles rc on rc.id = r.cycle_id
    where r.id = ranking_placements.ranking_id
      and r.author_id = (select auth.uid())
      and r.status in ('draft', 'published')
      and rc.status = 'open'
      and (rc.opens_at is null or rc.opens_at <= now())
      and (rc.closes_at is null or now() < rc.closes_at)
  )
);

create policy "insert placements in own open responses"
on public.ranking_placements
for insert
to authenticated
with check (
  exists (
    select 1
    from public.rankings r
    join public.ranking_cycles rc on rc.id = r.cycle_id
    where r.id = ranking_placements.ranking_id
      and r.author_id = (select auth.uid())
      and r.status in ('draft', 'published')
      and rc.status = 'open'
      and (rc.opens_at is null or rc.opens_at <= now())
      and (rc.closes_at is null or now() < rc.closes_at)
  )
);

create policy "update placements in own open responses"
on public.ranking_placements
for update
to authenticated
using (
  exists (
    select 1
    from public.rankings r
    join public.ranking_cycles rc on rc.id = r.cycle_id
    where r.id = ranking_placements.ranking_id
      and r.author_id = (select auth.uid())
      and r.status in ('draft', 'published')
      and rc.status = 'open'
      and (rc.opens_at is null or rc.opens_at <= now())
      and (rc.closes_at is null or now() < rc.closes_at)
  )
)
with check (
  exists (
    select 1
    from public.rankings r
    join public.ranking_cycles rc on rc.id = r.cycle_id
    where r.id = ranking_placements.ranking_id
      and r.author_id = (select auth.uid())
      and r.status in ('draft', 'published')
      and rc.status = 'open'
      and (rc.opens_at is null or rc.opens_at <= now())
      and (rc.closes_at is null or now() < rc.closes_at)
  )
);

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
  v_existing_status text;
  v_entity_type_id uuid;
  v_max_length integer;
  v_unique_count integer;
  v_valid_count integer;
  v_pool_count integer;
  v_period record;
  v_revision_before integer;
  v_published_at_before timestamptz;
  v_previous_placements jsonb := '[]'::jsonb;
  v_period_is_editable boolean := false;
begin
  if not public.is_permanent_ranked_user() then
    raise exception 'A permanent account is required to save a ranking';
  end if;
  if p_visibility not in ('public', 'unlisted', 'private') then
    raise exception 'Invalid ranking visibility';
  end if;

  select entity_type_id, max_length
  into v_entity_type_id, v_max_length
  from public.ranking_template_versions
  where id = p_template_version_id;

  if v_max_length is null then raise exception 'Unknown ranking template version'; end if;
  if cardinality(coalesce(p_entity_ids, '{}'::uuid[])) > v_max_length then raise exception 'Ranking has too many placements'; end if;

  select count(distinct entity_id)::integer
  into v_unique_count
  from unnest(coalesce(p_entity_ids, '{}'::uuid[])) as entity_id;
  if v_unique_count <> cardinality(coalesce(p_entity_ids, '{}'::uuid[])) then raise exception 'Ranking contains duplicate entities'; end if;

  select count(*)::integer
  into v_valid_count
  from public.entities e
  where e.id = any(coalesce(p_entity_ids, '{}'::uuid[]))
    and e.entity_type_id = v_entity_type_id
    and e.status = 'active'
    and e.deleted_at is null;
  if v_valid_count <> cardinality(coalesce(p_entity_ids, '{}'::uuid[])) then raise exception 'Ranking contains an invalid or wrong-type entity'; end if;

  select count(*)::integer
  into v_pool_count
  from public.ranking_template_entities
  where template_version_id = p_template_version_id;
  if v_pool_count > 0 and exists (
    select 1
    from unnest(coalesce(p_entity_ids, '{}'::uuid[])) option(entity_id)
    where not exists (
      select 1
      from public.ranking_template_entities rte
      where rte.template_version_id = p_template_version_id
        and rte.entity_id = option.entity_id
    )
  ) then
    raise exception 'Ranking contains an entity outside the saved eligibility pool';
  end if;

  select * into v_period
  from public.ranking_response_period(p_template_version_id, p_dataset_version_id, now());

  if p_existing_ranking_id is not null then
    select r.id, r.status
    into v_ranking_id, v_existing_status
    from public.rankings r
    join public.ranking_cycles rc on rc.id = r.cycle_id
    where r.id = p_existing_ranking_id
      and r.author_id = v_user_id
      and r.template_version_id = p_template_version_id
      and rc.slug = v_period.period_slug
      and r.status in ('draft', 'published')
    for update of r;
  end if;

  if v_ranking_id is null then
    select r.id, r.status
    into v_ranking_id, v_existing_status
    from public.rankings r
    join public.ranking_cycles rc on rc.id = r.cycle_id
    where r.author_id = v_user_id
      and r.template_version_id = p_template_version_id
      and rc.slug = v_period.period_slug
      and r.status in ('draft', 'published')
    order by coalesce(r.published_at, r.updated_at) desc, r.id desc
    limit 1
    for update of r;
  end if;

  if v_ranking_id is null then
    insert into public.rankings (
      template_version_id, dataset_version_id, author_id, status, visibility, title, note
    ) values (
      p_template_version_id,
      p_dataset_version_id,
      v_user_id,
      'draft',
      p_visibility,
      nullif(trim(p_title), ''),
      nullif(trim(p_note), '')
    )
    on conflict (author_id, template_version_id, cycle_id)
      where author_id is not null
        and cycle_id is not null
        and status in ('draft', 'published')
    do nothing
    returning id into v_ranking_id;

    if v_ranking_id is null then
      select r.id, r.status
      into v_ranking_id, v_existing_status
      from public.rankings r
      join public.ranking_cycles rc on rc.id = r.cycle_id
      where r.author_id = v_user_id
        and r.template_version_id = p_template_version_id
        and rc.slug = v_period.period_slug
        and r.status in ('draft', 'published')
      order by coalesce(r.published_at, r.updated_at) desc, r.id desc
      limit 1
      for update of r;
    end if;
  end if;

  if v_ranking_id is null then
    raise exception 'The ranking could not be opened';
  end if;

  if v_existing_status = 'published' then
    select r.revision,
           r.published_at,
           rc.status = 'open'
             and (rc.opens_at is null or rc.opens_at <= now())
             and (rc.closes_at is null or now() < rc.closes_at)
    into v_revision_before, v_published_at_before, v_period_is_editable
    from public.rankings r
    join public.ranking_cycles rc on rc.id = r.cycle_id
    where r.id = v_ranking_id;

    if not coalesce(v_period_is_editable, false) then
      raise exception 'This ranking period is closed';
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object('entityId', rp.entity_id, 'position', rp.position)
        order by rp.position
      ),
      '[]'::jsonb
    )
    into v_previous_placements
    from public.ranking_placements rp
    where rp.ranking_id = v_ranking_id;
  end if;

  update public.rankings
  set dataset_version_id = p_dataset_version_id,
      visibility = p_visibility,
      title = nullif(trim(p_title), ''),
      note = nullif(trim(p_note), ''),
      published_at = case when v_existing_status = 'published' then now() else published_at end,
      revision = revision + 1,
      updated_at = now()
  where id = v_ranking_id;

  delete from public.ranking_placements
  where ranking_id = v_ranking_id;

  insert into public.ranking_placements (ranking_id, entity_id, position)
  select v_ranking_id, entity_id, ordinal::integer
  from unnest(coalesce(p_entity_ids, '{}'::uuid[]))
  with ordinality as placement(entity_id, ordinal);

  insert into public.ranking_events (ranking_id, actor_id, event_type, payload)
  values (
    v_ranking_id,
    v_user_id,
    case when v_existing_status = 'published' then 'published_revision_saved' else 'draft_saved' end,
    jsonb_build_object(
      'placementCount', cardinality(coalesce(p_entity_ids, '{}'::uuid[])),
      'periodSlug', v_period.period_slug,
      'periodTitle', v_period.period_title,
      'revisionBefore', v_revision_before,
      'publishedAtBefore', v_published_at_before,
      'previousPlacements', v_previous_placements
    )
  );

  return v_ranking_id;
end;
$$;

create or replace function public.get_my_current_ranking_response(
  p_template_version_id uuid,
  p_dataset_version_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_period record;
  v_cycle_id uuid;
  v_cycle_status text;
  v_cycle_opens_at timestamptz;
  v_cycle_closes_at timestamptz;
  v_ranking_id uuid;
  v_status text;
  v_created_at timestamptz;
  v_updated_at timestamptz;
  v_published_at timestamptz;
  v_entity_ids jsonb := '[]'::jsonb;
  v_editable boolean := true;
begin
  if not public.is_permanent_ranked_user() then
    raise exception 'A permanent account is required to load a saved response';
  end if;

  select * into v_period
  from public.ranking_response_period(p_template_version_id, p_dataset_version_id, now());

  select id, status, opens_at, closes_at
  into v_cycle_id, v_cycle_status, v_cycle_opens_at, v_cycle_closes_at
  from public.ranking_cycles
  where template_id = v_period.template_id
    and slug = v_period.period_slug;

  if v_cycle_id is not null then
    v_editable := v_cycle_status = 'open'
      and (v_cycle_opens_at is null or v_cycle_opens_at <= now())
      and (v_cycle_closes_at is null or now() < v_cycle_closes_at);

    select r.id, r.status, r.created_at, r.updated_at, r.published_at
    into v_ranking_id, v_status, v_created_at, v_updated_at, v_published_at
    from public.rankings r
    where r.author_id = v_user_id
      and r.template_version_id = p_template_version_id
      and r.cycle_id = v_cycle_id
      and r.status in ('draft', 'published')
    order by coalesce(r.published_at, r.updated_at) desc, r.id desc
    limit 1;
  end if;

  if v_ranking_id is not null then
    select coalesce(jsonb_agg(e.canonical_key order by rp.position), '[]'::jsonb)
    into v_entity_ids
    from public.ranking_placements rp
    join public.entities e on e.id = rp.entity_id
    where rp.ranking_id = v_ranking_id;
  end if;

  return jsonb_build_object(
    'responseCadence', v_period.cadence,
    'periodSlug', v_period.period_slug,
    'periodTitle', v_period.period_title,
    'season', v_period.season,
    'week', v_period.week,
    'opensAt', v_period.opens_at,
    'closesAt', v_period.closes_at,
    'cycleId', v_cycle_id,
    'rankingId', v_ranking_id,
    'status', v_status,
    'editable', v_editable,
    'entityIds', v_entity_ids,
    'createdAt', v_created_at,
    'updatedAt', v_updated_at,
    'publishedAt', v_published_at
  );
end;
$$;

revoke execute on function public.save_my_ranking_draft(uuid, uuid, text, text, text, uuid[], uuid) from public, anon;
grant execute on function public.save_my_ranking_draft(uuid, uuid, text, text, text, uuid[], uuid) to authenticated;

revoke all on function public.get_my_current_ranking_response(uuid, uuid) from public, anon;
grant execute on function public.get_my_current_ranking_response(uuid, uuid) to authenticated;

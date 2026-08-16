-- Make response periods an explicit template setting and enforce one active
-- response per person, template version, and period. Existing duplicates are
-- retained as withdrawn records so no opinion history is physically deleted.

alter table public.ranking_template_versions
add column if not exists response_cadence text not null default 'once';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ranking_template_versions_response_cadence_check'
      and conrelid = 'public.ranking_template_versions'::regclass
  ) then
    alter table public.ranking_template_versions
    add constraint ranking_template_versions_response_cadence_check
    check (response_cadence in ('once', 'weekly', 'seasonal'));
  end if;
end;
$$;

create or replace function public.set_ranking_template_response_cadence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_configured_cadence text;
begin
  v_configured_cadence := coalesce(
    new.display_config ->> 'responseCadence',
    new.display_config #>> '{config,responseCadence}'
  );
  if v_configured_cadence in ('once', 'weekly', 'seasonal') then
    new.response_cadence := v_configured_cadence;
  end if;
  return new;
end;
$$;

revoke all on function public.set_ranking_template_response_cadence() from public, anon, authenticated;

drop trigger if exists set_ranking_template_response_cadence_trigger on public.ranking_template_versions;
create trigger set_ranking_template_response_cadence_trigger
before insert or update of display_config, response_cadence
on public.ranking_template_versions
for each row
execute function public.set_ranking_template_response_cadence();

update public.ranking_template_versions tv
set response_cadence = case
  when tv.display_config #>> '{config,responseCadence}' in ('once', 'weekly', 'seasonal')
    then tv.display_config #>> '{config,responseCadence}'
  else tv.response_cadence
end;

-- Preserve the weekly meaning already attached to templates with published
-- weekly snapshots before explicit cadence settings existed.
update public.ranking_template_versions tv
set response_cadence = 'weekly'
where exists (
  select 1
  from public.rankings r
  join public.ranking_cycles rc on rc.id = r.cycle_id
  where r.template_version_id = tv.id
    and rc.slug ~ '^[0-9]{4}-response-week-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
);

update public.ranking_template_versions tv
set response_cadence = 'weekly',
    display_config = jsonb_set(tv.display_config, '{responseCadence}', '"weekly"'::jsonb, true)
from public.ranking_templates rt
where rt.id = tv.template_id
  and rt.slug = 'official-top-25';

create or replace function public.ranking_response_period(
  p_template_version_id uuid,
  p_dataset_version_id uuid,
  p_at timestamptz default now()
)
returns table (
  template_id uuid,
  cadence text,
  period_slug text,
  period_title text,
  season integer,
  week integer,
  opens_at timestamptz,
  closes_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_local_date date;
  v_period_start date;
  v_period_end date;
begin
  select tv.template_id,
         tv.response_cadence,
         coalesce(dv.season, extract(year from p_at at time zone 'America/New_York')::integer)
  into template_id, cadence, season
  from public.ranking_template_versions tv
  left join public.dataset_versions dv on dv.id = p_dataset_version_id
  where tv.id = p_template_version_id;

  if template_id is null then
    raise exception 'Unknown ranking template version';
  end if;

  if cadence = 'weekly' then
    v_local_date := (p_at at time zone 'America/New_York')::date;
    v_period_start := v_local_date - (extract(isodow from v_local_date)::integer - 1);
    v_period_end := v_period_start + 7;
    period_slug := format('%s-response-week-%s', season, to_char(v_period_start, 'YYYY-MM-DD'));
    period_title := format(
      'Week of %s–%s',
      to_char(v_period_start, 'Mon FMDD'),
      case
        when extract(month from v_period_start) = extract(month from v_period_end - 1)
          then to_char(v_period_end - 1, 'FMDD')
        else to_char(v_period_end - 1, 'Mon FMDD')
      end
    );
    week := extract(week from v_period_start)::integer;
    opens_at := v_period_start::timestamp at time zone 'America/New_York';
    closes_at := v_period_end::timestamp at time zone 'America/New_York';
  elsif cadence = 'seasonal' then
    period_slug := format('%s-season', season);
    period_title := format('%s season', season);
    week := null;
    opens_at := null;
    closes_at := null;
  else
    period_slug := 'single-response';
    period_title := 'One-time poll';
    week := null;
    opens_at := null;
    closes_at := null;
  end if;

  return next;
end;
$$;

revoke all on function public.ranking_response_period(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.ranking_response_period(uuid, uuid, timestamptz) to authenticated, service_role;

create or replace function public.assign_ranking_response_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period record;
  v_cycle_id uuid;
begin
  if new.cycle_id is not null then
    return new;
  end if;

  select * into v_period
  from public.ranking_response_period(new.template_version_id, new.dataset_version_id, now());

  insert into public.ranking_cycles (
    template_id, slug, title, season, week, opens_at, closes_at, status
  ) values (
    v_period.template_id,
    v_period.period_slug,
    v_period.period_title,
    v_period.season,
    v_period.week,
    v_period.opens_at,
    v_period.closes_at,
    'open'
  )
  on conflict (template_id, slug) do update set
    title = excluded.title,
    season = excluded.season,
    week = excluded.week,
    opens_at = excluded.opens_at,
    closes_at = excluded.closes_at,
    status = case
      when public.ranking_cycles.status = 'archived' then public.ranking_cycles.status
      else 'open'
    end
  returning id into v_cycle_id;

  new.cycle_id := v_cycle_id;
  return new;
end;
$$;

revoke all on function public.assign_ranking_response_cycle() from public, anon, authenticated;

drop trigger if exists assign_ranking_response_cycle_trigger on public.rankings;
create trigger assign_ranking_response_cycle_trigger
before insert or update of template_version_id, dataset_version_id, cycle_id
on public.rankings
for each row
execute function public.assign_ranking_response_cycle();

-- Repair the UTC boundary and label created by the older weekly trigger.
with weekly_cycles as (
  select rc.id,
         split_part(rc.slug, 'response-week-', 2)::date as period_start
  from public.ranking_cycles rc
  where rc.slug ~ '^[0-9]{4}-response-week-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
)
update public.ranking_cycles rc
set title = format(
      'Week of %s–%s',
      to_char(wc.period_start, 'Mon FMDD'),
      case
        when extract(month from wc.period_start) = extract(month from wc.period_start + 6)
          then to_char(wc.period_start + 6, 'FMDD')
        else to_char(wc.period_start + 6, 'Mon FMDD')
      end
    ),
    week = extract(week from wc.period_start)::integer,
    opens_at = wc.period_start::timestamp at time zone 'America/New_York',
    closes_at = (wc.period_start + 7)::timestamp at time zone 'America/New_York'
from weekly_cycles wc
where rc.id = wc.id;

-- Existing drafts were created before cycle assignment happened at save time.
update public.rankings
set cycle_id = null
where cycle_id is null
  and status = 'draft';

-- Keep the most recent published response when duplicates already exist. If a
-- draft and a published response collide, the published response wins.
with ordered as (
  select r.id,
         r.author_id,
         first_value(r.id) over (
           partition by r.author_id, r.template_version_id, r.cycle_id
           order by (r.status = 'published') desc,
                    coalesce(r.published_at, r.updated_at) desc,
                    r.id desc
         ) as canonical_ranking_id,
         row_number() over (
           partition by r.author_id, r.template_version_id, r.cycle_id
           order by (r.status = 'published') desc,
                    coalesce(r.published_at, r.updated_at) desc,
                    r.id desc
         ) as response_number
  from public.rankings r
  where r.author_id is not null
    and r.cycle_id is not null
    and r.status in ('draft', 'published')
), archived as (
  update public.rankings r
  set status = 'withdrawn',
      revision = r.revision + 1,
      updated_at = now()
  from ordered o
  where r.id = o.id
    and o.response_number > 1
  returning r.id, r.author_id, o.canonical_ranking_id
)
insert into public.ranking_events (ranking_id, actor_id, event_type, payload)
select id,
       author_id,
       'period_duplicate_archived',
       jsonb_build_object('canonicalRankingId', canonical_ranking_id)
from archived;

create unique index if not exists rankings_one_response_per_period_uidx
on public.rankings (author_id, template_version_id, cycle_id)
where author_id is not null
  and cycle_id is not null
  and status in ('draft', 'published');

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
begin
  if not public.is_permanent_ranked_user() then
    raise exception 'A permanent account is required to save a relational ballot';
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

  if v_existing_status = 'published' then
    raise exception 'You already submitted this ranking for %', v_period.period_title;
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

  if v_existing_status = 'published' then
    raise exception 'You already submitted this ranking for %', v_period.period_title;
  end if;
  if v_ranking_id is null then
    raise exception 'The ranking draft could not be opened';
  end if;

  update public.rankings
  set dataset_version_id = p_dataset_version_id,
      visibility = p_visibility,
      title = nullif(trim(p_title), ''),
      note = nullif(trim(p_note), ''),
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
    'draft_saved',
    jsonb_build_object(
      'placementCount', cardinality(coalesce(p_entity_ids, '{}'::uuid[])),
      'periodSlug', v_period.period_slug,
      'periodTitle', v_period.period_title
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
  v_ranking_id uuid;
  v_status text;
  v_created_at timestamptz;
  v_updated_at timestamptz;
  v_published_at timestamptz;
  v_entity_ids jsonb := '[]'::jsonb;
begin
  if not public.is_permanent_ranked_user() then
    raise exception 'A permanent account is required to load a saved response';
  end if;

  select * into v_period
  from public.ranking_response_period(p_template_version_id, p_dataset_version_id, now());

  select id
  into v_cycle_id
  from public.ranking_cycles
  where template_id = v_period.template_id
    and slug = v_period.period_slug;

  if v_cycle_id is not null then
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

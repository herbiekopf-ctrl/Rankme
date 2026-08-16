-- Metric availability is scoped to the selected dataset version. Provider IDs
-- are unique per entity/source because CFBD numeric IDs can repeat across
-- teams, players, and other resource types.
alter table public.entity_external_ids
  drop constraint if exists entity_external_ids_source_slug_external_id_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.entity_external_ids'::regclass
      and conname = 'entity_external_ids_entity_id_source_slug_key'
  ) then
    alter table public.entity_external_ids
      add constraint entity_external_ids_entity_id_source_slug_key
      unique (entity_id, source_slug);
  end if;
end
$$;

drop index if exists public.entity_external_ids_entity_id_idx;
create index if not exists entity_external_ids_source_external_idx
  on public.entity_external_ids (source_slug, external_id);

insert into public.entity_external_ids (entity_id, source_slug, external_id)
select e.id, 'cfbd', substring(e.canonical_key from '^team:(.+)$')
from public.entities e
join public.entity_types et on et.id = e.entity_type_id
join public.domains d on d.id = e.domain_id
where d.slug = 'college-football'
  and et.slug = 'team'
  and e.status = 'active'
  and e.deleted_at is null
  and e.canonical_key ~ '^team:.+$'
on conflict (entity_id, source_slug)
do update set external_id = excluded.external_id;

with approved(entity_type_slug, key, label, description, unit, metric_group, direction) as (
  values
    ('team', 'wins', 'Wins', 'Total wins in the selected season.', 'integer', 'Resume', 'desc'),
    ('team', 'losses', 'Losses', 'Total losses in the selected season. Lower is better.', 'integer', 'Resume', 'asc'),
    ('team', 'gamesPlayed', 'Games played', 'Completed games in the selected season.', 'integer', 'Resume', 'desc'),
    ('team', 'winPct', 'Win percentage', 'Wins plus half of ties divided by games played.', 'percentage', 'Resume', 'desc'),
    ('team', 'fpi', 'FPI', 'Football Power Index team strength rating.', 'signed', 'Power', 'desc'),
    ('team', 'spOverall', 'SP+ overall', 'Opponent-adjusted overall SP+ rating.', 'signed', 'Power', 'desc'),
    ('team', 'spOffense', 'SP+ offense', 'Opponent-adjusted offensive SP+ rating.', 'signed', 'Power', 'desc'),
    ('team', 'spDefense', 'SP+ defense', 'Opponent-adjusted defensive SP+ rating. Lower is better.', 'signed', 'Power', 'asc'),
    ('team', 'strengthOfSchedule', 'Strength of schedule', 'Combined win percentage of scheduled opponents.', 'percentage', 'Resume', 'desc'),
    ('team', 'apRank', 'AP rank', 'Latest AP poll position. Lower is better.', 'integer', 'Resume', 'asc'),
    ('team', 'recruitingRank', 'Recruiting rank', 'Team recruiting class rank. Lower is better.', 'integer', 'Roster', 'asc'),
    ('team', 'recruitingPoints', 'Recruiting points', 'Composite points for the selected recruiting class.', 'decimal', 'Roster', 'desc'),
    ('team', 'returningProduction', 'Returning production', 'Share of prior production returning to the roster.', 'percentage', 'Roster', 'desc'),
    ('stadium', 'capacity', 'Capacity', 'Official listed venue capacity.', 'integer', 'Physical', 'desc'),
    ('stadium', 'constructionYear', 'Year opened', 'Year the venue was constructed.', 'integer', 'Physical', 'desc'),
    ('stadium', 'elevation', 'Elevation', 'Venue elevation above sea level.', 'decimal', 'Physical', 'desc'),
    ('stadium', 'latitude', 'Latitude', 'Venue latitude.', 'decimal', 'Physical', 'desc'),
    ('stadium', 'longitude', 'Longitude', 'Venue longitude.', 'decimal', 'Physical', 'desc'),
    ('player', 'classYear', 'Class year', 'Roster class year.', 'integer', 'Roster', 'desc'),
    ('player', 'height', 'Height', 'Listed player height in inches.', 'integer', 'Physical', 'desc'),
    ('player', 'weight', 'Weight', 'Listed player weight in pounds.', 'integer', 'Physical', 'desc'),
    ('town', 'teamCount', 'Team count', 'Number of FBS teams connected to this town.', 'integer', 'Other', 'desc')
)
update public.attribute_definitions ad
set label = approved.label,
    description = approved.description,
    unit = approved.unit,
    metric_group = approved.metric_group,
    direction = approved.direction
from approved
join public.entity_types et on et.slug = approved.entity_type_slug
where ad.entity_type_id = et.id and ad.key = approved.key;

create or replace function public.get_rankable_dataset(p_season integer, p_entity_type_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain_id uuid;
  v_dataset_version_id uuid;
  v_version_key text;
  v_fetched_at timestamptz;
  v_source_request_count integer;
  v_source_metadata jsonb;
  v_entity_type_id uuid;
  v_result jsonb;
begin
  select id into v_domain_id from public.domains
  where slug = 'college-football' and status = 'active';

  select et.id into v_entity_type_id from public.entity_types et
  where et.domain_id = v_domain_id
    and et.slug = p_entity_type_slug
    and coalesce((et.presentation_schema ->> 'rankable')::boolean, false);
  if v_entity_type_id is null then return null; end if;

  select dv.id, dv.version_key, dv.fetched_at, dv.source_request_count, dv.source_metadata
  into v_dataset_version_id, v_version_key, v_fetched_at, v_source_request_count, v_source_metadata
  from public.dataset_versions dv
  join public.datasets d on d.id = dv.dataset_id
  where d.domain_id = v_domain_id
    and d.slug = 'cfbd-season'
    and dv.season = p_season
    and dv.status in ('published', 'superseded')
  order by dv.fetched_at desc limit 1;
  if v_dataset_version_id is null then return null; end if;

  select jsonb_build_object(
    'datasetVersionId', v_dataset_version_id,
    'versionKey', v_version_key,
    'fetchedAt', v_fetched_at,
    'sourceRequestCount', v_source_request_count,
    'sourceMetadata', coalesce(v_source_metadata, '{}'::jsonb),
    'entityType', p_entity_type_slug,
    'metrics', coalesce((
      with version_entities as (
        select e.id from public.entities e
        where e.domain_id = v_domain_id
          and e.entity_type_id = v_entity_type_id
          and e.status = 'active' and e.deleted_at is null
          and exists (
            select 1 from public.entity_attribute_values season_value
            where season_value.dataset_version_id = v_dataset_version_id
              and season_value.entity_id = e.id
          )
      ), metric_stats as (
        select ad.key, ad.label, coalesce(ad.description, '') as description,
          ad.value_type, ad.unit, ad.metric_group, ad.direction, ds.name as source,
          count(distinct eav.entity_id)::integer as populated_entity_count,
          count(distinct eav.number_value)::integer as distinct_value_count,
          (select count(*)::integer from version_entities) as eligible_entity_count
        from public.attribute_definitions ad
        join public.entity_attribute_values eav
          on eav.attribute_definition_id = ad.id
         and eav.dataset_version_id = v_dataset_version_id
         and eav.number_value is not null
        join version_entities ve on ve.id = eav.entity_id
        left join public.data_sources ds on ds.id = ad.source_id
        where ad.entity_type_id = v_entity_type_id
          and ad.public_visible and ad.value_type = 'number'
        group by ad.id, ds.name
      )
      select jsonb_agg(jsonb_build_object(
        'key', ms.key, 'label', ms.label, 'description', ms.description,
        'valueType', ms.value_type, 'unit', ms.unit,
        'metricGroup', ms.metric_group, 'direction', ms.direction,
        'source', ms.source,
        'populatedEntityCount', ms.populated_entity_count,
        'eligibleEntityCount', ms.eligible_entity_count,
        'coverage', case when ms.eligible_entity_count = 0 then 0
          else ms.populated_entity_count::double precision / ms.eligible_entity_count end,
        'distinctValueCount', ms.distinct_value_count,
        'available', ms.populated_entity_count > 0,
        'comparative', ms.distinct_value_count > 1
      ) order by ms.metric_group nulls last, ms.label)
      from metric_stats ms where ms.populated_entity_count > 0
    ), '[]'::jsonb),
    'entities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'relationalId', e.id, 'canonicalKey', e.canonical_key,
        'name', e.name, 'shortName', e.short_name,
        'description', e.description, 'imageUrl', e.image_url, 'color', e.color,
        'aliases', coalesce((select jsonb_agg(ea.alias order by ea.alias)
          from public.entity_aliases ea where ea.entity_id = e.id), '[]'::jsonb),
        'externalIds', coalesce((select jsonb_object_agg(eei.source_slug, eei.external_id)
          from public.entity_external_ids eei where eei.entity_id = e.id), '{}'::jsonb),
        'attributes', coalesce((
          select jsonb_object_agg(ad.key, case
            when eav.number_value is not null then to_jsonb(eav.number_value)
            when eav.text_value is not null then to_jsonb(eav.text_value)
            when eav.boolean_value is not null then to_jsonb(eav.boolean_value)
            when eav.date_value is not null then to_jsonb(eav.date_value::text)
            else eav.json_value end)
          from public.entity_attribute_values eav
          join public.attribute_definitions ad
            on ad.id = eav.attribute_definition_id and ad.public_visible
          where eav.dataset_version_id = v_dataset_version_id and eav.entity_id = e.id
        ), '{}'::jsonb)
      ) order by e.name)
      from public.entities e
      where e.domain_id = v_domain_id and e.entity_type_id = v_entity_type_id
        and e.status = 'active' and e.deleted_at is null
        and exists (
          select 1 from public.entity_attribute_values season_value
          where season_value.dataset_version_id = v_dataset_version_id
            and season_value.entity_id = e.id
        )
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke execute on function public.get_rankable_dataset(integer, text) from public, anon, authenticated;
grant execute on function public.get_rankable_dataset(integer, text) to service_role;

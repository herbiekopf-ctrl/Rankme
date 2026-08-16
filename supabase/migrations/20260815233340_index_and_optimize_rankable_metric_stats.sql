create index if not exists entity_attribute_values_numeric_catalog_idx
  on public.entity_attribute_values (
    dataset_version_id,
    attribute_definition_id,
    number_value,
    entity_id
  )
  where number_value is not null;

create or replace function public.get_rankable_catalog(p_season integer)
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
begin
  select id into v_domain_id from public.domains
  where slug = 'college-football' and status = 'active';

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

  return jsonb_build_object(
    'datasetVersionId', v_dataset_version_id,
    'versionKey', v_version_key,
    'fetchedAt', v_fetched_at,
    'sourceRequestCount', v_source_request_count,
    'sourceMetadata', coalesce(v_source_metadata, '{}'::jsonb),
    'categories', coalesce((
      with version_entity_ids as materialized (
        select distinct eav.entity_id
        from public.entity_attribute_values eav
        where eav.dataset_version_id = v_dataset_version_id
      ), entity_counts as (
        select e.entity_type_id, count(*)::integer as entity_count
        from version_entity_ids version_entity
        join public.entities e on e.id = version_entity.entity_id
        join public.entity_types et on et.id = e.entity_type_id
        where et.domain_id = v_domain_id
          and coalesce((et.presentation_schema ->> 'rankable')::boolean, false)
          and e.status = 'active' and e.deleted_at is null
        group by e.entity_type_id
      ), metric_stats as materialized (
        select ad.entity_type_id, ad.id as attribute_definition_id,
          count(distinct eav.entity_id)::integer as populated_entity_count,
          count(distinct eav.number_value)::integer as distinct_value_count
        from public.entity_attribute_values eav
        join public.attribute_definitions ad
          on ad.id = eav.attribute_definition_id
         and ad.public_visible and ad.value_type = 'number'
        where eav.dataset_version_id = v_dataset_version_id
          and eav.number_value is not null
        group by ad.entity_type_id, ad.id
      ), metric_counts as (
        select ms.entity_type_id,
          count(*) filter (where ms.distinct_value_count > 1)::integer as metric_count,
          count(*) filter (where ms.populated_entity_count > 0)::integer as populated_metric_count
        from metric_stats ms group by ms.entity_type_id
      )
      select jsonb_agg(jsonb_build_object(
        'entityType', et.slug,
        'count', coalesce(ec.entity_count, 0),
        'metricCount', coalesce(mc.metric_count, 0),
        'populatedMetricCount', coalesce(mc.populated_metric_count, 0)
      ) order by et.plural_name)
      from public.entity_types et
      left join entity_counts ec on ec.entity_type_id = et.id
      left join metric_counts mc on mc.entity_type_id = et.id
      where et.domain_id = v_domain_id
        and coalesce((et.presentation_schema ->> 'rankable')::boolean, false)
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_rankable_catalog(integer) from public, anon, authenticated;
grant execute on function public.get_rankable_catalog(integer) to service_role;

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
  select id into v_domain_id from public.domains where slug = 'college-football' and status = 'active';
  select dv.id, dv.version_key, dv.fetched_at, dv.source_request_count, dv.source_metadata
  into v_dataset_version_id, v_version_key, v_fetched_at, v_source_request_count, v_source_metadata
  from public.dataset_versions dv
  join public.datasets d on d.id = dv.dataset_id
  where d.domain_id = v_domain_id and d.slug = 'cfbd-season' and dv.season = p_season
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
      select jsonb_agg(jsonb_build_object(
        'entityType', et.slug,
        'count', (select count(*) from public.entities e where e.entity_type_id = et.id and e.status = 'active' and e.deleted_at is null and exists (
          select 1 from public.entity_attribute_values season_value
          where season_value.dataset_version_id = v_dataset_version_id and season_value.entity_id = e.id
        )),
        'metricCount', (select count(*) from public.attribute_definitions ad where ad.entity_type_id = et.id and ad.public_visible and ad.value_type = 'number')
      ) order by et.plural_name)
      from public.entity_types et
      where et.domain_id = v_domain_id and coalesce((et.presentation_schema ->> 'rankable')::boolean, false)
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_rankable_catalog(integer) from public, anon, authenticated;
grant execute on function public.get_rankable_catalog(integer) to service_role;

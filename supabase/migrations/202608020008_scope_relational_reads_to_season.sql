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
  select id into v_domain_id from public.domains where slug = 'college-football' and status = 'active';
  select et.id into v_entity_type_id from public.entity_types et
  where et.domain_id = v_domain_id and et.slug = p_entity_type_slug
    and coalesce((et.presentation_schema ->> 'rankable')::boolean, false);
  if v_entity_type_id is null then return null; end if;
  select dv.id, dv.version_key, dv.fetched_at, dv.source_request_count, dv.source_metadata
  into v_dataset_version_id, v_version_key, v_fetched_at, v_source_request_count, v_source_metadata
  from public.dataset_versions dv join public.datasets d on d.id = dv.dataset_id
  where d.domain_id = v_domain_id and d.slug = 'cfbd-season' and dv.season = p_season
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
      select jsonb_agg(jsonb_build_object(
        'key', ad.key, 'label', ad.label, 'description', coalesce(ad.description, ''),
        'valueType', ad.value_type, 'unit', ad.unit, 'metricGroup', ad.metric_group,
        'direction', ad.direction, 'source', ds.name
      ) order by ad.metric_group nulls last, ad.label)
      from public.attribute_definitions ad left join public.data_sources ds on ds.id = ad.source_id
      where ad.entity_type_id = v_entity_type_id and ad.public_visible and ad.value_type = 'number'
    ), '[]'::jsonb),
    'entities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'relationalId', e.id, 'canonicalKey', e.canonical_key, 'name', e.name,
        'shortName', e.short_name, 'description', e.description, 'imageUrl', e.image_url, 'color', e.color,
        'aliases', coalesce((select jsonb_agg(ea.alias order by ea.alias) from public.entity_aliases ea where ea.entity_id = e.id), '[]'::jsonb),
        'externalIds', coalesce((select jsonb_object_agg(eei.source_slug, eei.external_id) from public.entity_external_ids eei where eei.entity_id = e.id), '{}'::jsonb),
        'attributes', coalesce((
          select jsonb_object_agg(ad.key, case
            when eav.number_value is not null then to_jsonb(eav.number_value)
            when eav.text_value is not null then to_jsonb(eav.text_value)
            when eav.boolean_value is not null then to_jsonb(eav.boolean_value)
            when eav.date_value is not null then to_jsonb(eav.date_value::text)
            else eav.json_value end)
          from public.entity_attribute_values eav
          join public.attribute_definitions ad on ad.id = eav.attribute_definition_id and ad.public_visible
          where eav.dataset_version_id = v_dataset_version_id and eav.entity_id = e.id
        ), '{}'::jsonb)
      ) order by e.name)
      from public.entities e
      where e.domain_id = v_domain_id and e.entity_type_id = v_entity_type_id
        and e.status = 'active' and e.deleted_at is null
        and exists (select 1 from public.entity_attribute_values season_value
          where season_value.dataset_version_id = v_dataset_version_id and season_value.entity_id = e.id)
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

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
  from public.dataset_versions dv join public.datasets d on d.id = dv.dataset_id
  where d.domain_id = v_domain_id and d.slug = 'cfbd-season' and dv.season = p_season
    and dv.status in ('published', 'superseded')
  order by dv.fetched_at desc limit 1;
  if v_dataset_version_id is null then return null; end if;
  return jsonb_build_object(
    'datasetVersionId', v_dataset_version_id, 'versionKey', v_version_key,
    'fetchedAt', v_fetched_at, 'sourceRequestCount', v_source_request_count,
    'sourceMetadata', coalesce(v_source_metadata, '{}'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entityType', et.slug,
        'count', (select count(*) from public.entities e
          where e.entity_type_id = et.id and e.status = 'active' and e.deleted_at is null
            and exists (select 1 from public.entity_attribute_values season_value
              where season_value.dataset_version_id = v_dataset_version_id and season_value.entity_id = e.id)),
        'metricCount', (select count(*) from public.attribute_definitions ad
          where ad.entity_type_id = et.id and ad.public_visible and ad.value_type = 'number')
      ) order by et.plural_name)
      from public.entity_types et
      where et.domain_id = v_domain_id and coalesce((et.presentation_schema ->> 'rankable')::boolean, false)
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_rankable_dataset(integer, text) from public, anon, authenticated;
revoke execute on function public.get_rankable_catalog(integer) from public, anon, authenticated;
grant execute on function public.get_rankable_dataset(integer, text) to service_role;
grant execute on function public.get_rankable_catalog(integer) to service_role;

-- Top 25 is the only official poll. Every published response is automatically
-- assigned to a stable weekly cycle in the dataset season.

update public.ranking_templates
set status = 'archived', updated_at = now()
where template_kind = 'official' and slug <> 'official-top-25' and status = 'active';

create or replace function public.assign_ranking_response_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template_id uuid;
  v_season integer;
  v_period_start date;
  v_period_week integer;
  v_cycle_id uuid;
begin
  if new.status <> 'published' or old.status = 'published' then
    return new;
  end if;

  select tv.template_id, dv.season
  into v_template_id, v_season
  from public.ranking_template_versions tv
  left join public.dataset_versions dv on dv.id = new.dataset_version_id
  where tv.id = new.template_version_id;

  if v_template_id is null then
    raise exception 'Cannot assign a response period without a valid ranking template';
  end if;

  v_season := coalesce(v_season, extract(year from coalesce(new.published_at, now()))::integer);
  v_period_start := date_trunc('week', coalesce(new.published_at, now()) at time zone 'America/New_York')::date;
  v_period_week := extract(week from v_period_start)::integer;

  insert into public.ranking_cycles (template_id, slug, title, season, week, opens_at, closes_at, status)
  values (
    v_template_id,
    format('%s-response-week-%s', v_season, to_char(v_period_start, 'YYYY-MM-DD')),
    format('%s response week of %s', v_season, to_char(v_period_start, 'Mon DD')),
    v_season,
    v_period_week,
    v_period_start::timestamptz,
    (v_period_start + 7)::timestamptz,
    'open'
  )
  on conflict (template_id, slug) do update set
    title = excluded.title,
    season = excluded.season,
    week = excluded.week,
    opens_at = excluded.opens_at,
    closes_at = excluded.closes_at
  returning id into v_cycle_id;

  new.cycle_id := v_cycle_id;
  return new;
end;
$$;

revoke all on function public.assign_ranking_response_cycle() from public, anon, authenticated;

drop trigger if exists assign_ranking_response_cycle_trigger on public.rankings;
create trigger assign_ranking_response_cycle_trigger
before update of status on public.rankings
for each row
when (new.status = 'published' and old.status is distinct from new.status)
execute function public.assign_ranking_response_cycle();

create index if not exists ranking_cycles_period_lookup_idx
on public.ranking_cycles (template_id, season, week, opens_at desc);

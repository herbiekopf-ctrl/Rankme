create index if not exists rankings_author_template_history_idx
on public.rankings (author_id, template_version_id, published_at desc)
where status = 'published' and author_id is not null;

create or replace function public.link_ranked_ranking_history()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.supersedes_ranking_id is null and new.author_id is not null then
    select r.id into new.supersedes_ranking_id
    from public.rankings r
    where r.author_id = new.author_id
      and r.template_version_id = new.template_version_id
      and r.status = 'published'
    order by r.published_at desc, r.id desc
    limit 1;
  end if;
  return new;
end;
$$;

create trigger rankings_link_history_before_insert
before insert on public.rankings
for each row execute function public.link_ranked_ranking_history();

with ordered as (
  select id, lag(id) over (
    partition by author_id, template_version_id
    order by published_at, id
  ) as previous_id
  from public.rankings
  where status = 'published' and author_id is not null
)
update public.rankings r
set supersedes_ranking_id = ordered.previous_id
from ordered
where r.id = ordered.id
  and r.supersedes_ranking_id is null
  and ordered.previous_id is not null;

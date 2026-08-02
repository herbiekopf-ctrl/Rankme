-- Cache authentication calls once per statement and avoid overlapping SELECT
-- policies. These patterns follow Supabase's RLS performance guidance.

create index if not exists entities_canonical_key_idx on public.entities (canonical_key) where status = 'active' and deleted_at is null;
create index if not exists ranking_templates_slug_status_idx on public.ranking_templates (slug, status);
create index if not exists dataset_versions_season_lookup_idx on public.dataset_versions (dataset_id, season, status, fetched_at desc);

drop policy if exists "users create own profile" on public.profiles;
create policy "permanent users create own profile" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and (select public.is_permanent_ranked_user()));
drop policy if exists "users update own profile" on public.profiles;
create policy "permanent users update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select public.is_permanent_ranked_user()))
  with check (id = (select auth.uid()) and (select public.is_permanent_ranked_user()));

drop policy if exists "read visible templates" on public.ranking_templates;
create policy "read visible templates" on public.ranking_templates for select using (
  (status = 'active' and visibility in ('public', 'unlisted')) or created_by = (select auth.uid())
);
drop policy if exists "permanent users create templates" on public.ranking_templates;
create policy "permanent users create templates" on public.ranking_templates for insert to authenticated
  with check (created_by = (select auth.uid()) and (select public.is_permanent_ranked_user()));
drop policy if exists "permanent users manage own templates" on public.ranking_templates;
create policy "permanent users manage own templates" on public.ranking_templates for update to authenticated
  using (created_by = (select auth.uid()) and (select public.is_permanent_ranked_user()))
  with check (created_by = (select auth.uid()) and (select public.is_permanent_ranked_user()));

drop policy if exists "read visible template versions" on public.ranking_template_versions;
create policy "read visible template versions" on public.ranking_template_versions for select using (
  exists (select 1 from public.ranking_templates rt where rt.id = template_id and (
    (rt.status = 'active' and rt.visibility in ('public', 'unlisted')) or rt.created_by = (select auth.uid())
  ))
);
drop policy if exists "permanent users manage own template versions" on public.ranking_template_versions;
create policy "permanent users insert own template versions" on public.ranking_template_versions for insert to authenticated
  with check ((select public.is_permanent_ranked_user()) and exists (
    select 1 from public.ranking_templates rt where rt.id = template_id and rt.created_by = (select auth.uid())
  ));
create policy "permanent users update own template versions" on public.ranking_template_versions for update to authenticated
  using ((select public.is_permanent_ranked_user()) and exists (
    select 1 from public.ranking_templates rt where rt.id = template_id and rt.created_by = (select auth.uid())
  ))
  with check ((select public.is_permanent_ranked_user()) and exists (
    select 1 from public.ranking_templates rt where rt.id = template_id and rt.created_by = (select auth.uid())
  ));
create policy "permanent users delete own template versions" on public.ranking_template_versions for delete to authenticated
  using ((select public.is_permanent_ranked_user()) and exists (
    select 1 from public.ranking_templates rt where rt.id = template_id and rt.created_by = (select auth.uid())
  ));

drop policy if exists "read visible template entities" on public.ranking_template_entities;
create policy "read visible template entities" on public.ranking_template_entities for select using (
  exists (select 1 from public.ranking_template_versions tv join public.ranking_templates rt on rt.id = tv.template_id
    where tv.id = template_version_id and ((rt.status = 'active' and rt.visibility in ('public', 'unlisted')) or rt.created_by = (select auth.uid())))
);
drop policy if exists "permanent users manage own template entities" on public.ranking_template_entities;
create policy "permanent users insert own template entities" on public.ranking_template_entities for insert to authenticated
  with check ((select public.is_permanent_ranked_user()) and exists (
    select 1 from public.ranking_template_versions tv join public.ranking_templates rt on rt.id = tv.template_id
    where tv.id = template_version_id and rt.created_by = (select auth.uid())
  ));
create policy "permanent users update own template entities" on public.ranking_template_entities for update to authenticated
  using ((select public.is_permanent_ranked_user()) and exists (
    select 1 from public.ranking_template_versions tv join public.ranking_templates rt on rt.id = tv.template_id
    where tv.id = template_version_id and rt.created_by = (select auth.uid())
  ))
  with check ((select public.is_permanent_ranked_user()) and exists (
    select 1 from public.ranking_template_versions tv join public.ranking_templates rt on rt.id = tv.template_id
    where tv.id = template_version_id and rt.created_by = (select auth.uid())
  ));
create policy "permanent users delete own template entities" on public.ranking_template_entities for delete to authenticated
  using ((select public.is_permanent_ranked_user()) and exists (
    select 1 from public.ranking_template_versions tv join public.ranking_templates rt on rt.id = tv.template_id
    where tv.id = template_version_id and rt.created_by = (select auth.uid())
  ));

drop policy if exists "read published or own rankings" on public.rankings;
create policy "read published or own rankings" on public.rankings for select using (
  (status = 'published' and visibility in ('public', 'unlisted')) or author_id = (select auth.uid())
);
drop policy if exists "permanent users create rankings" on public.rankings;
create policy "permanent users create rankings" on public.rankings for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'draft' and (select public.is_permanent_ranked_user()));
drop policy if exists "permanent users update own rankings" on public.rankings;
create policy "permanent users update own rankings" on public.rankings for update to authenticated
  using (author_id = (select auth.uid()) and status = 'draft' and (select public.is_permanent_ranked_user()))
  with check (author_id = (select auth.uid()) and status in ('draft', 'published') and (select public.is_permanent_ranked_user()));
drop policy if exists "delete own drafts" on public.rankings;
create policy "permanent users delete own drafts" on public.rankings for delete to authenticated
  using (author_id = (select auth.uid()) and status = 'draft' and (select public.is_permanent_ranked_user()));

drop policy if exists "read placements for visible rankings" on public.ranking_placements;
create policy "read placements for visible rankings" on public.ranking_placements for select using (
  exists (select 1 from public.rankings r where r.id = ranking_id and (
    (r.status = 'published' and r.visibility in ('public', 'unlisted')) or r.author_id = (select auth.uid())
  ))
);
drop policy if exists "manage placements in own drafts" on public.ranking_placements;
create policy "insert placements in own drafts" on public.ranking_placements for insert to authenticated
  with check (exists (select 1 from public.rankings r where r.id = ranking_id and r.author_id = (select auth.uid()) and r.status = 'draft'));
create policy "update placements in own drafts" on public.ranking_placements for update to authenticated
  using (exists (select 1 from public.rankings r where r.id = ranking_id and r.author_id = (select auth.uid()) and r.status = 'draft'))
  with check (exists (select 1 from public.rankings r where r.id = ranking_id and r.author_id = (select auth.uid()) and r.status = 'draft'));
create policy "delete placements in own drafts" on public.ranking_placements for delete to authenticated
  using (exists (select 1 from public.rankings r where r.id = ranking_id and r.author_id = (select auth.uid()) and r.status = 'draft'));

drop policy if exists "read own ranking events" on public.ranking_events;
create policy "read own ranking events" on public.ranking_events for select to authenticated using (
  exists (select 1 from public.rankings r where r.id = ranking_id and r.author_id = (select auth.uid()))
);
drop policy if exists "append own ranking events" on public.ranking_events;
create policy "append own ranking events" on public.ranking_events for insert to authenticated with check (
  actor_id = (select auth.uid()) and exists (select 1 from public.rankings r where r.id = ranking_id and r.author_id = (select auth.uid()))
);

drop policy if exists "users read own cohorts" on public.user_cohort_values;
create policy "users read own cohorts" on public.user_cohort_values for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "permanent users manage own cohorts" on public.user_cohort_values;
create policy "permanent users insert own cohorts" on public.user_cohort_values for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_permanent_ranked_user()));
create policy "permanent users delete own cohorts" on public.user_cohort_values for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.is_permanent_ranked_user()));

drop policy if exists "users read own affiliations" on public.user_entity_affiliations;
create policy "users read own affiliations" on public.user_entity_affiliations for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "users manage own affiliations" on public.user_entity_affiliations;
create policy "users insert own affiliations" on public.user_entity_affiliations for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users update own affiliations" on public.user_entity_affiliations for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users delete own affiliations" on public.user_entity_affiliations for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "read public or joined groups" on public.groups;
create policy "read public or joined groups" on public.groups for select using (
  visibility in ('public', 'unlisted') or owner_id = (select auth.uid()) or public.is_ranked_group_member(id, (select auth.uid()))
);
drop policy if exists "create groups" on public.groups;
create policy "permanent users create groups" on public.groups for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.is_permanent_ranked_user()));
drop policy if exists "owners manage groups" on public.groups;
create policy "permanent owners update groups" on public.groups for update to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_permanent_ranked_user()))
  with check (owner_id = (select auth.uid()) and (select public.is_permanent_ranked_user()));

drop policy if exists "read group memberships" on public.group_memberships;
create policy "read group memberships" on public.group_memberships for select to authenticated using (
  user_id = (select auth.uid()) or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = (select auth.uid()))
);
drop policy if exists "group owners manage memberships" on public.group_memberships;
create policy "group owners insert memberships" on public.group_memberships for insert to authenticated
  with check (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = (select auth.uid())));
create policy "group owners update memberships" on public.group_memberships for update to authenticated
  using (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = (select auth.uid())));
create policy "group owners delete memberships" on public.group_memberships for delete to authenticated
  using (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = (select auth.uid())));

import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/clients";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = createAdminSupabaseClient();
  if (!client) return NextResponse.json({ connected: false, templates: [], message: "Add the Supabase server secret to load relational polls." });

  const { data: templates, error: templateError } = await client.from("ranking_templates").select("id, title, description, visibility").eq("status", "active").eq("visibility", "public").order("created_at", { ascending: false }).limit(100);
  if (templateError) return NextResponse.json({ connected: true, templates: [], message: templateError.message }, { status: 503 });
  const templateIds = (templates ?? []).map((template) => template.id);
  if (!templateIds.length) return NextResponse.json({ connected: true, templates: [], message: "Create the first public relational poll." });

  const { data: versions, error: versionError } = await client.from("ranking_template_versions").select("id, template_id, entity_type_id, version").in("template_id", templateIds).order("version", { ascending: false });
  if (versionError) return NextResponse.json({ connected: true, templates: [], message: versionError.message }, { status: 503 });
  const versionIds = (versions ?? []).map((version) => version.id);
  const [{ data: templateEntities }, { data: rankings }] = await Promise.all([
    versionIds.length ? client.from("ranking_template_entities").select("template_version_id, entity_id").in("template_version_id", versionIds) : Promise.resolve({ data: [] }),
    versionIds.length ? client.from("rankings").select("id, template_version_id").in("template_version_id", versionIds).eq("status", "published").eq("visibility", "public") : Promise.resolve({ data: [] }),
  ]);
  const rankingIds = (rankings ?? []).map((ranking) => ranking.id);
  const { data: placements } = rankingIds.length
    ? await client.from("ranking_placements").select("ranking_id, entity_id").in("ranking_id", rankingIds)
    : { data: [] };
  const versionByRanking = new Map((rankings ?? []).map((ranking) => [ranking.id, ranking.template_version_id]));
  const entityIdsByVersion = new Map<string, Set<string>>();
  for (const row of templateEntities ?? []) {
    const ids = entityIdsByVersion.get(row.template_version_id) ?? new Set<string>();
    ids.add(row.entity_id);
    entityIdsByVersion.set(row.template_version_id, ids);
  }
  for (const row of placements ?? []) {
    const versionId = versionByRanking.get(row.ranking_id);
    if (!versionId) continue;
    const ids = entityIdsByVersion.get(versionId) ?? new Set<string>();
    ids.add(row.entity_id);
    entityIdsByVersion.set(versionId, ids);
  }
  const entityIds = [...new Set([...entityIdsByVersion.values()].flatMap((ids) => [...ids]))];
  const { data: entities } = entityIds.length
    ? await client.from("entities").select("id, name, entity_type_id").in("id", entityIds)
    : { data: [] };
  const entityById = new Map((entities ?? []).map((entity) => [entity.id, entity]));
  const templateById = new Map((templates ?? []).map((template) => [template.id, template]));
  const latestVersionByTemplate = new Map<string, (typeof versions)[number]>();
  for (const version of versions ?? []) if (!latestVersionByTemplate.has(version.template_id)) latestVersionByTemplate.set(version.template_id, version);

  return NextResponse.json({
    connected: true,
    message: "Live relational catalog",
    templates: [...latestVersionByTemplate.values()].map((version) => ({
      templateId: version.template_id,
      templateVersionId: version.id,
      title: templateById.get(version.template_id)?.title ?? "Untitled poll",
      entities: [...(entityIdsByVersion.get(version.id) ?? [])].map((id) => entityById.get(id)).filter(Boolean).map((entity) => ({ id: entity?.id, name: entity?.name })),
    })).filter((template) => template.entities.length > 0),
  });
}

"use client";

import Image from "next/image";
import { useState } from "react";
import { resolveEntityMedia } from "@/lib/domain/entityMedia";
import type { RankableEntity } from "@/lib/domain/types";

export function TeamMark({ entity, size = "medium" }: { entity: RankableEntity; size?: "small" | "medium" | "large" }) {
  const media = resolveEntityMedia(entity);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageFailed = media.imageUrl === failedImageUrl;
  const dimensions = size === "small" ? 32 : size === "large" ? 46 : 40;

  if (media.kind === "image" && media.imageUrl && !imageFailed) {
    return <span className={`entity-mark mark-${size}`} style={{ background: media.backgroundColor }} data-media-role={media.role}>
      <Image src={media.imageUrl} alt="" width={dimensions} height={dimensions} sizes={`${dimensions}px`} unoptimized onError={() => setFailedImageUrl(media.imageUrl ?? null)} />
    </span>;
  }
  return <span className={`entity-mark mark-${size}`} style={{ background: media.backgroundColor }} data-media-role="fallback">{media.initials}</span>;
}

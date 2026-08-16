export type ConferenceMedia = { imageUrl: string; color: string };

const ESPN_CONFERENCE_IDS: Record<string, { id: number; color: string }> = {
  acc: { id: 1, color: "#013ca6" },
  "atlantic coast": { id: 1, color: "#013ca6" },
  "big 12": { id: 4, color: "#e23d34" },
  "big ten": { id: 5, color: "#0088ce" },
  b1g: { id: 5, color: "#0088ce" },
  sec: { id: 8, color: "#f2b800" },
  southeastern: { id: 8, color: "#f2b800" },
  "pac-12": { id: 9, color: "#202e5f" },
  "pac 12": { id: 9, color: "#202e5f" },
  "conference usa": { id: 12, color: "#003b70" },
  "c-usa": { id: 12, color: "#003b70" },
  "mid-american": { id: 15, color: "#007a43" },
  mac: { id: 15, color: "#007a43" },
  "mountain west": { id: 17, color: "#4f2d7f" },
  mwc: { id: 17, color: "#4f2d7f" },
  "fbs independents": { id: 18, color: "#52606a" },
  independent: { id: 18, color: "#52606a" },
  "sun belt": { id: 37, color: "#f4a61d" },
  "american athletic": { id: 151, color: "#0a4b8e" },
  american: { id: 151, color: "#0a4b8e" },
  aac: { id: 151, color: "#0a4b8e" },
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/conference/g, "").replace(/\s+/g, " ").trim();
}

export function resolveConferenceMedia(name: string): ConferenceMedia | null {
  const match = ESPN_CONFERENCE_IDS[normalize(name)] ?? ESPN_CONFERENCE_IDS[name.toLowerCase().trim()];
  if (!match) return null;
  return {
    imageUrl: `https://a.espncdn.com/i/teamlogos/ncaa_conf/500/${match.id}.png`,
    color: match.color,
  };
}

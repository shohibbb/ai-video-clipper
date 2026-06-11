export type VideoSourcePreview = {
  kind: "image" | "video";
  url: string;
};

export function getYouTubeVideoId(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v");
      }

      const [prefix, id] = url.pathname.split("/").filter(Boolean);

      if (["shorts", "embed", "live"].includes(prefix) && id) {
        return id;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function getYouTubeThumbnailUrl(value: string) {
  const videoId = getYouTubeVideoId(value);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
}

export function isDirectVideoUrl(value: string) {
  try {
    const url = new URL(value);
    return /\.(mp4|mov|webm)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

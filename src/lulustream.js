const API_BASE = "https://lulustream.com/api";

export async function uploadByUrl(url) {
  const key = process.env.LULUSTREAM_API_KEY;
  if (!key) throw new Error("LULUSTREAM_API_KEY is not configured");

  const endpoint = new URL(API_BASE + "/upload/url");
  endpoint.searchParams.set("key", key);
  endpoint.searchParams.set("url", url);

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`LuluStream API returned HTTP ${response.status}`);
  }

  return response.json();
}

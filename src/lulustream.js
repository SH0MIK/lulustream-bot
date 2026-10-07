const API_BASE = "https://lulustream.com/api";

async function apiGet(path, params = {}) {
  const key = process.env.LULUSTREAM_API_KEY;
  if (!key) throw new Error("LULUSTREAM_API_KEY is not configured");

  const endpoint = new URL(API_BASE + path);
  endpoint.searchParams.set("key", key);

  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      endpoint.searchParams.set(name, String(value));
    }
  }

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`LuluStream API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.status && Number(data.status) !== 200) {
    throw new Error(data.msg || "LuluStream API request failed");
  }

  return data;
}

export function uploadByUrl(url) {
  return apiGet("/upload/url", { url });
}

export function getFileInfo(fileCode) {
  return apiGet("/file/info", { file_code: fileCode });
}

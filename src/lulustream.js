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

export async function listFolders(parentId = 0) {
  const data = await apiGet("/folder/list", { fld_id: parentId, files: 0 });
  return data.result?.folders || [];
}

export async function getUploadServer() {
  const data = await apiGet("/upload/server");
  const server = data.result;
  if (!server || typeof server !== "string") {
    throw new Error("LuluStream did not return an upload server");
  }
  return server;
}

export async function uploadFile(filePath, fldId = 0, name) {
  const { default: fs } = await import("node:fs");
  const { default: FormData } = await import("form-data");
  const server = await getUploadServer();
  const stat = await fs.promises.stat(filePath);
  const form = new FormData();

  form.append("key", process.env.LULUSTREAM_API_KEY);
  form.append("fld_id", String(fldId));
  form.append("file", fs.createReadStream(filePath), {
    filename: name,
    knownLength: stat.size
  });

  const response = await fetch(server, {
    method: "POST",
    headers: {
      ...form.getHeaders(),
      "Content-Length": String(form.getLengthSync())
    },
    body: form
  });

  if (!response.ok) {
    throw new Error(`LuluStream upload failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.status && Number(data.status) !== 200) {
    throw new Error(data.msg || "LuluStream upload failed");
  }

  const item = data.files?.find(x => x.status === "OK") || data.files?.[0];
  if (!item?.filecode) {
    throw new Error("LuluStream did not return a file code");
  }

  return item.filecode;
}

export function uploadByUrl(url, fldId = 0) {
  return apiGet("/upload/url", { url, fld_id: fldId });
}

export function getFileInfo(fileCode) {
  return apiGet("/file/info", { file_code: fileCode });
}

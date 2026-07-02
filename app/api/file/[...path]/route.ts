import { QB_REALM, QB_TOKEN } from "@/lib/config";

export async function GET(
  _request: Request,
  { params }: { params: { path: string[] } }
) {
  const apiPath = params.path.join("/");
  const qbUrl = `https://api.quickbase.com/v1/files/${apiPath}`;

  const res = await fetch(qbUrl, {
    headers: {
      "QB-Realm-Hostname": QB_REALM,
      Authorization: `QB-USER-TOKEN ${QB_TOKEN}`,
    },
  });

  if (!res.ok) {
    return new Response("File not found", { status: res.status });
  }

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const buffer = await res.arrayBuffer();

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

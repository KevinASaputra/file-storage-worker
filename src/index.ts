export interface Env {
  FILES: R2Bucket;
  PUBLIC_BASE_URL: string;
}

const ADMIN_TOKEN = "CHANGE_THIS_SECRET_TOKEN";

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function getExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}

function getMime(name: string): string {
  return MIME_MAP[getExt(name)] || "application/octet-stream";
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function unauthorized(): Response {
  return json({ error: "Unauthorized" }, 401);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/") {
      return json({
        service: "Kevin FileHub Storeage Worker",
        endpoints: [
          "GET /list",
          "GET /download/:filename",
          "GET /view/:filename",
          "PUT /upload/:filename?token=SECRET",
          "DELETE /delete/:filename?token=SECRET"
        ]
      });
    }
    if (path === "/list") {
      const objects = await env.FILES.list();
      return json({
        files: objects.objects.map((obj) => ({
          name: obj.key,
          size: obj.size,
          uploaded: obj.uploaded
        }))
      });
    }

    if (path.startsWith("/upload/") && request.method === "PUT") {
      const token = url.searchParams.get("token");
      if (token !== ADMIN_TOKEN) return unauthorized();

      const filename = decodeURIComponent(path.replace("/upload/", ""));
      await env.FILES.put(filename, request.body, {
        httpMetadata: {
          contentType: getMime(filename),
        },
      });

      return json({
        success: true,
        file: filename,
        url: `${env.PUBLIC_BASE_URL} /download/${filename} `
      });
    }

    if (path.startsWith("/delete/") && request.method === "DELETE") {
      const token = url.searchParams.get("token");
      if (token !== ADMIN_TOKEN) return unauthorized();

      const filename = decodeURIComponent(path.replace("/delete/", ""));
      await env.FILES.delete(filename);

      return json({
        success: true,
        deleted: filename
      });
    }

    if (path.startsWith("/download/")) {
      const filename = decodeURIComponent(path.replace("/download/", ""));
      const object = await env.FILES.get(filename);

      if (!object) {
        return new Response("File not found", { status: 404 });
      }

      return new Response(object.body, {
        headers: {
          "content-type": getMime(filename),
          "content-disposition": `attachment; filename = "${filename}"`,
          "cache-control": "public, max-age=3600"
        }
      });
    }

    if (path.startsWith("/view/")) {
      const filename = decodeURIComponent(path.replace("/view/", ""));
      const object = await env.FILES.get(filename);

      if (!object) {
        return new Response("File not found", { status: 404 });
      }

      return new Response(object.body, {
        headers: {
          "content-type": getMime(filename),
          "content-disposition": `inline; filename = "${filename}"`,
          "cache-control": "public, max-age=3600"
        }
      });
    }

    return new Response("Not Found", { status: 404 });

  },
};

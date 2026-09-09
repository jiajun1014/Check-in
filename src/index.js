const JSON_HEADERS = {
  "Content-Type": "application/json; charset=UTF-8",
  "Cache-Control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}

async function readJson(request) {
  try { return await request.json(); }
  catch { return null; }
}

function corsHeaders(request) {
  return {
    "Access-Control-Allow-Origin": new URL(request.url).origin,
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password, X-User-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    try {
      // Employee: create request
      if (url.pathname === "/api/requests" && request.method === "POST") {
        const body = await readJson(request);
        if (!body?.id || !body?.name || !body?.reason || !body?.requesterToken) {
          return json({ error: "缺少必要資料" }, 400);
        }

        const existing = await env.DB.prepare(
          "SELECT id FROM leave_requests WHERE id = ?"
        ).bind(body.id).first();
        if (existing) return json({ error: "申請編號已存在" }, 409);

        await env.DB.prepare(`
          INSERT INTO leave_requests
          (id, date, name, reason, status, submitted_at, requester_token)
          VALUES (?, ?, ?, ?, 'pending', ?, ?)
        `).bind(
          body.id,
          body.date || new Date().toISOString().slice(0,10),
          String(body.name).slice(0,100),
          String(body.reason).slice(0,1000),
          new Date().toISOString(),
          String(body.requesterToken).slice(0,200)
        ).run();

        return json({ ok: true, id: body.id }, 201);
      }

      // Employee: only own requests
      if (url.pathname === "/api/employee/requests" && request.method === "GET") {
        const token = request.headers.get("X-User-Token");
        if (!token) return json({ error: "缺少使用者識別" }, 401);

        const result = await env.DB.prepare(`
          SELECT id, date, name, reason, status, submitted_at AS submittedAt,
                 reviewed_at AS reviewedAt, review_note AS reviewNote
          FROM leave_requests
          WHERE requester_token = ?
          ORDER BY submitted_at ASC
        `).bind(token).all();

        return json({ requests: result.results || [] });
      }

      // Admin: list all requests
      if (url.pathname === "/api/admin/requests" && request.method === "GET") {
        if (!env.ADMIN_PASSWORD || request.headers.get("X-Admin-Password") !== env.ADMIN_PASSWORD) {
          return json({ error: "管理者密碼錯誤" }, 401);
        }

        const result = await env.DB.prepare(`
          SELECT id, date, name, reason, status, submitted_at AS submittedAt,
                 reviewed_at AS reviewedAt, review_note AS reviewNote
          FROM leave_requests
          ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END,
                   submitted_at ASC
        `).all();

        return json({ requests: result.results || [] });
      }

      // Admin: approve/reject
      if (url.pathname === "/api/admin/review" && request.method === "POST") {
        if (!env.ADMIN_PASSWORD || request.headers.get("X-Admin-Password") !== env.ADMIN_PASSWORD) {
          return json({ error: "管理者密碼錯誤" }, 401);
        }

        const body = await readJson(request);
        if (!body?.id || !["approve", "reject"].includes(body.action)) {
          return json({ error: "操作資料錯誤" }, 400);
        }

        const status = body.action === "approve" ? "approved" : "rejected";
        const result = await env.DB.prepare(`
          UPDATE leave_requests
          SET status = ?, reviewed_at = ?, review_note = ?
          WHERE id = ? AND status = 'pending'
        `).bind(
          status,
          new Date().toISOString(),
          String(body.reviewNote || "").slice(0,1000),
          body.id
        ).run();

        if (!result.meta.changes) {
          return json({ error: "找不到待審核申請,或已經審核過" }, 404);
        }
        return json({ ok: true });
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ error: "伺服器發生錯誤" }, 500);
    }
  }
};


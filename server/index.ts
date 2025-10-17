import PostalMime from "postal-mime";

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS mailboxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mailbox_id INTEGER NOT NULL,
    sender TEXT NOT NULL,
    subject TEXT,
    preview TEXT,
    text_body TEXT,
    html_body TEXT,
    message_identifier TEXT,
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
  );`,
];

let schemaReadyPromise: Promise<void> | null = null;

interface Env {
  DB: D1Database;
  AUTH_TOKEN?: string;
  MAIL_DOMAIN?: string;
  ASSETS: {
    fetch: typeof fetch;
  };
}

async function ensureSchema(db: D1Database): Promise<void> {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      for (const statement of SCHEMA_STATEMENTS) {
        await db.prepare(statement).run();
      }
    })().catch((error) => {
      schemaReadyPromise = null;
      console.error("Schema initialization failed:", error);
      throw error;
    });
  }
  return schemaReadyPromise;
}

function jsonResponse<T>(data: T, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function unauthorizedResponse(): Response {
  return jsonResponse({ error: "unauthorized" }, { status: 401 });
}

function badRequest(message: string): Response {
  return jsonResponse({ error: message }, { status: 400 });
}

function normalizeAddress(input: unknown, env: Env): string {
  const value = String(input ?? "")
    .trim()
    .toLowerCase();

  if (!value) {
    throw new Error("邮箱地址不能为空");
  }

  if (!value.includes("@")) {
    throw new Error("缺少域名");
  }

  const [localPart, domainPart] = value.split("@");
  const localPattern = /^[a-z0-9._-]+$/;
  const domainPattern = /^[a-z0-9.-]+\\.[a-z]{2,}$/;

  if (
    !localPart ||
    !domainPart
  ) {
    throw new Error("邮箱地址格式不正确");
  }

  return `${localPart}@${domainPart}`;
}

function extractToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header && header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  const alt = request.headers.get("x-auth-token");
  if (alt) {
    return alt.trim();
  }
  return null;
}

function previewFromBodies(text: string | null, html: string | null): string {
  const source =
    text && text.trim()
      ? text.trim()
      : html
      ? html
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "";
  if (!source) {
    return "";
  }
  return source.length > 200 ? `${source.slice(0, 200)}…` : source;
}

async function handleListMailboxes(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    "SELECT id, address, created_at FROM mailboxes ORDER BY created_at DESC"
  ).all();
  return jsonResponse({ mailboxes: result.results ?? [] });
}

async function handleCreateMailbox(
  request: Request,
  env: Env
): Promise<Response> {
  let payload: { address?: string };
  try {
    payload = await request.json();
  } catch {
    return badRequest("请求体必须是 JSON");
  }

  let normalized: string;
  try {
    normalized = normalizeAddress(payload.address, env);
  } catch (error) {
    return badRequest((error as Error).message);
  }

  try {
    await env.DB.prepare("INSERT INTO mailboxes (address) VALUES (?)")
      .bind(normalized)
      .run();
    const inserted = await env.DB.prepare(
      "SELECT id FROM mailboxes WHERE address = ?"
    )
      .bind(normalized)
      .first<{ id: number }>();
    return jsonResponse(
      {
        mailbox: {
          id: inserted?.id ?? null,
          address: normalized,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      return jsonResponse({ error: "邮箱已存在" }, { status: 409 });
    }
    console.error("Failed to create mailbox:", error);
    return jsonResponse({ error: "服务器错误" }, { status: 500 });
  }
}

async function handleDeleteMailbox(id: string, env: Env): Promise<Response> {
  const mailboxId = Number(id);
  if (!Number.isInteger(mailboxId)) {
    return badRequest("邮箱 ID 不合法");
  }
  await env.DB.prepare("DELETE FROM mailboxes WHERE id = ?")
    .bind(mailboxId)
    .run();
  return jsonResponse({ ok: true });
}

async function handleListMessages(
  mailboxId: string,
  env: Env
): Promise<Response> {
  const id = Number(mailboxId);
  if (!Number.isInteger(id)) {
    return badRequest("邮箱 ID 不合法");
  }

  const mailbox = await env.DB.prepare(
    "SELECT id, address FROM mailboxes WHERE id = ?"
  )
    .bind(id)
    .first();
  if (!mailbox) {
    return jsonResponse({ error: "邮箱不存在" }, { status: 404 });
  }

  const messages = await env.DB.prepare(
    `SELECT id, sender, subject, preview, received_at
     FROM messages
     WHERE mailbox_id = ?
     ORDER BY received_at DESC, id DESC
     LIMIT 200`
  )
    .bind(id)
    .all();

  return jsonResponse({
    mailbox,
    messages: messages.results ?? [],
  });
}

async function handleGetMessage(
  messageId: string,
  env: Env
): Promise<Response> {
  const id = Number(messageId);
  if (!Number.isInteger(id)) {
    return badRequest("邮件 ID 不合法");
  }

  const message = await env.DB.prepare(
    `SELECT m.id,
            m.mailbox_id,
            mb.address AS mailbox_address,
            m.sender,
            m.subject,
            m.preview,
            m.text_body,
            m.html_body,
            m.received_at,
            m.message_identifier
     FROM messages m
     JOIN mailboxes mb ON mb.id = m.mailbox_id
     WHERE m.id = ?`
  )
    .bind(id)
    .first();

  if (!message) {
    return jsonResponse({ error: "邮件不存在" }, { status: 404 });
  }

  return jsonResponse({ message });
}

async function handleDeleteMessage(
  messageId: string,
  env: Env
): Promise<Response> {
  const id = Number(messageId);
  if (!Number.isInteger(id)) {
    return badRequest("邮件 ID 不合法");
  }
  await env.DB.prepare("DELETE FROM messages WHERE id = ?").bind(id).run();
  return jsonResponse({ ok: true });
}

function getMessageIdentifier(message: unknown): string | null {
  const headers = (message as { headers?: Headers }).headers;
  if (headers && typeof headers.get === "function") {
    return headers.get("Message-ID");
  }
  return null;
}

async function handleEmail(message: any, env: Env): Promise<void> {
  await ensureSchema(env.DB);

  const recipientsRaw: unknown[] = Array.isArray(message.to)
    ? message.to
    : message.to
    ? [message.to]
    : [];
  if (!recipientsRaw.length) {
    return;
  }

  const recipients = recipientsRaw
    .map((address: unknown) =>
      typeof address === "string" ? address.trim().toLowerCase() : ""
    )
    .filter(Boolean);

  if (!recipients.length) {
    return;
  }

  const sender = Array.isArray(message.from)
    ? message.from.join(", ")
    : message.from || "";

  const emailParsed = await PostalMime.parse(message.raw);

  const subject = emailParsed.subject || "";
  const textBody = emailParsed.text ?? null;
  const htmlBody =
    emailParsed.html ||
    (textBody ? `<html><body><div>${textBody}</div></body></html>` : null);

  const preview = previewFromBodies(textBody, htmlBody);
  const messageId = getMessageIdentifier(message);

  for (const recipient of recipients) {
    try {
      const mailbox = await env.DB.prepare(
        "SELECT id FROM mailboxes WHERE address = ?"
      )
        .bind(recipient)
        .first();
      if (!mailbox) {
        continue;
      }

      await env.DB.prepare(
        `INSERT INTO messages
          (mailbox_id, sender, subject, preview, text_body, html_body, message_identifier)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          mailbox.id,
          sender,
          subject || null,
          preview,
          textBody,
          htmlBody,
          messageId
        )
        .run();
    } catch (error) {
      console.error("Failed to store message for", recipient, error);
    }
  }
}

async function handleFetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
        "access-control-allow-headers":
          "Authorization,Content-Type,X-Auth-Token",
      },
    });
  }

  if (pathname.startsWith("/api/")) {
    await ensureSchema(env.DB);

    const authToken = extractToken(request);
    const expected = env.AUTH_TOKEN;
    if (!expected) {
      console.warn("Missing AUTH_TOKEN binding");
      return new Response("Server misconfigured", { status: 500 });
    }
    if (authToken !== expected) {
      return unauthorizedResponse();
    }

    if (request.method === "GET" && pathname === "/api/session") {
      return jsonResponse({
        ok: true,
        mailDomain: env.MAIL_DOMAIN ?? null,
      });
    }

    if (request.method === "GET" && pathname === "/api/mailboxes") {
      return handleListMailboxes(env);
    }

    if (request.method === "POST" && pathname === "/api/mailboxes") {
      return handleCreateMailbox(request, env);
    }

    const mailboxMatch = pathname.match(/^\/api\/mailboxes\/(\d+)$/);
    if (mailboxMatch && request.method === "DELETE") {
      return handleDeleteMailbox(mailboxMatch[1], env);
    }

    const mailboxMessagesMatch = pathname.match(
      /^\/api\/mailboxes\/(\d+)\/messages$/
    );
    if (mailboxMessagesMatch && request.method === "GET") {
      return handleListMessages(mailboxMessagesMatch[1], env);
    }

    const messageMatch = pathname.match(/^\/api\/messages\/(\d+)$/);
    if (messageMatch) {
      if (request.method === "GET") {
        return handleGetMessage(messageMatch[1], env);
      }
      if (request.method === "DELETE") {
        return handleDeleteMessage(messageMatch[1], env);
      }
    }

    return new Response("Not found", { status: 404 });
  }

  if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
    return env.ASSETS.fetch(request);
  }

  return new Response("Not found", { status: 404 });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return handleFetch(request, env);
  },
  async email(message: any, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleEmail(message, env);
  },
};

import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  getAuthUser,
  hashPassword,
  HttpError,
  verifyPassword,
} from "@/lib/auth";
import { handle, json, rateLimit, readJson } from "@/lib/api-helpers";

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  return handle(async () => {
    const { action } = await params;

    if (action === "logout") {
      await destroySession();
      return json({ ok: true });
    }

    const body = await readJson<{
      email?: string;
      password?: string;
      name?: string;
      currentPassword?: string;
      newPassword?: string;
    }>(req);

    if (action === "login") {
      if (!rateLimit(`login:${body.email ?? "?"}`, 10, 60_000)) {
        throw new HttpError(429, "Too many attempts — wait a minute");
      }
      if (!body.email || !body.password) throw new HttpError(400, "Email and password required");
      const user = await db.user.findUnique({ where: { email: body.email.toLowerCase().trim() } });
      if (!user || !verifyPassword(body.password, user.passwordHash)) {
        throw new HttpError(401, "Incorrect email or password");
      }
      await createSession(user.id);
      return json({ id: user.id, name: user.name, email: user.email });
    }

    if (action === "register") {
      const email = body.email?.toLowerCase().trim();
      if (!email || !body.password) throw new HttpError(400, "Email and password required");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Invalid email address");
      if (body.password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) throw new HttpError(409, "An account with this email already exists");
      const user = await db.user.create({
        data: {
          email,
          name: body.name?.trim() || email.split("@")[0],
          passwordHash: hashPassword(body.password),
        },
      });
      await createSession(user.id);
      return json({ id: user.id, name: user.name, email: user.email }, 201);
    }

    if (action === "update-profile") {
      const user = await getAuthUser();
      if (!user) throw new HttpError(401, "Not signed in");
      const name = body.name?.trim();
      if (!name) throw new HttpError(400, "Name cannot be empty");
      const updated = await db.user.update({
        where: { id: user.id },
        data: { name },
        select: { id: true, name: true, email: true },
      });
      return json({ user: updated });
    }

    if (action === "change-password") {
      const user = await getAuthUser();
      if (!user) throw new HttpError(401, "Not signed in");
      if (!body.currentPassword || !body.newPassword) {
        throw new HttpError(400, "Current and new password required");
      }
      if (body.newPassword.length < 8) {
        throw new HttpError(400, "New password must be at least 8 characters");
      }
      const fullUser = await db.user.findUnique({ where: { id: user.id } });
      if (!fullUser || !verifyPassword(body.currentPassword, fullUser.passwordHash)) {
        throw new HttpError(400, "Current password is incorrect");
      }
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(body.newPassword) },
      });
      return json({ ok: true });
    }

    throw new HttpError(404, "Unknown auth action");
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ action: string }> }) {
  return handle(async () => {
    const { action } = await params;
    if (action === "me") {
      const user = await getAuthUser();
      return json({ user });
    }
    throw new HttpError(404, "Unknown auth action");
  });
}

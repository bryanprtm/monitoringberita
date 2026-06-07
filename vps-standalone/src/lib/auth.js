import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-only-secret-CHANGE-ME'
);

export const COOKIE_NAME = 'ncc_token';

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, SECRET);
  return payload;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
}

export async function requireAuth(req, reply) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return reply.code(401).send({ error: 'Unauthorized' });
  try {
    const payload = await verifyToken(token);
    req.user = { id: payload.sub, role: payload.role, username: payload.username };
  } catch {
    return reply.code(401).send({ error: 'Invalid token' });
  }
}
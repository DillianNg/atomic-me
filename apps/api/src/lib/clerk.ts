import { createClerkClient, verifyToken } from '@clerk/backend';

import { env } from '../config/env.js';

/** Kieu claims tra ve sau verify (lay truc tiep tu chinh verifyToken). */
export type ClerkJwtClaims = Awaited<ReturnType<typeof verifyToken>>;

/**
 * Clerk Backend API client (vd users.getUser). Khoi tao 1 lan voi secret key.
 */
export const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.CLERK_PUBLISHABLE_KEY,
});

/**
 * Verify Clerk session JWT bang secret key (JWKS tu dong fetch + cache).
 * verifyToken@v3 khong nhan option `issuer`, nen ta rang buoc issuer thu cong
 * sau khi verify de chac chan token den tu instance Clerk cua minh.
 * Throw neu token sai/het han hoac issuer khong khop.
 */
export async function verifyClerkToken(token: string): Promise<ClerkJwtClaims> {
  const claims = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
  if (claims.iss !== env.CLERK_JWT_ISSUER) {
    throw new Error('Token issuer mismatch');
  }
  return claims;
}

/** Profile rut gon lay tu Clerk Backend API. */
export interface ClerkUserProfile {
  clerkId: string;
  email: string;
  name: string | null;
}

/**
 * Lay email + ten tu Clerk theo clerkId. Default session token khong chua
 * email, nen lazy-create user can goi Backend API de lay email (unique trong DB).
 */
export async function getClerkUserProfile(clerkId: string): Promise<ClerkUserProfile> {
  const user = await clerkClient.users.getUser(clerkId);
  const primary =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ??
    user.emailAddresses[0];
  if (!primary) {
    throw new Error(`Clerk user ${clerkId} has no email address`);
  }
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return {
    clerkId,
    email: primary.emailAddress,
    name: fullName.length > 0 ? fullName : null,
  };
}

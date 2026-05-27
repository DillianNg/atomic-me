import type { preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';

import * as clerk from '../lib/clerk.js';
import { UnauthorizedError } from '../lib/errors.js';
import * as userRepo from '../repositories/user.repo.js';
import { logAudit } from '../services/audit.service.js';
import { provisionUser } from '../services/user.service.js';

const BEARER_PREFIX = 'Bearer ';

/**
 * Auth plugin (Phase 3).
 *
 * - Decorate `request.user` = null (mac dinh).
 * - Decorate `fastify.authenticate`: preHandler bao ve route protected.
 *   + Lay Bearer token tu header Authorization.
 *   + Verify qua Clerk (lib/clerk verifyClerkToken).
 *   + Lazy-create user local neu chua sync (race: webhook chua toi).
 *   + Gan request.user = { id, clerkId, email }.
 *   + Throw UnauthorizedError neu thieu/sai/het han token, ghi audit AUTH_FAILED.
 *
 * Bao mat: KHONG log token/email o muc info. Chi log claim `sub` khi debug.
 */
export default fp(
  async (fastify) => {
    fastify.decorateRequest('user', null);

    const authenticate: preHandlerHookHandler = async (request) => {
      const header = request.headers.authorization;
      if (!header || !header.startsWith(BEARER_PREFIX)) {
        throw new UnauthorizedError('Missing bearer token');
      }
      const token = header.slice(BEARER_PREFIX.length).trim();
      if (token.length === 0) {
        throw new UnauthorizedError('Missing bearer token');
      }

      const db = request.server.db;

      let clerkId: string;
      try {
        const claims = await clerk.verifyClerkToken(token);
        clerkId = claims.sub;
      } catch (err) {
        request.log.warn({ err }, 'Clerk token verification failed');
        // Fire-and-forget audit; khong chua token/PII.
        void logAudit({
          db,
          log: request.log,
          action: 'AUTH_FAILED',
          entityType: 'Auth',
          entityId: 'unknown',
          userId: null,
          metadata: { reason: 'token_verification_failed' },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        });
        throw new UnauthorizedError('Invalid or expired token');
      }

      request.log.debug({ sub: clerkId }, 'Clerk token verified');

      // Resolve user local; lazy-create neu chua co (webhook co the chua toi).
      let user = await userRepo.findByClerkId(db, clerkId);
      if (!user) {
        const profile = await clerk.getClerkUserProfile(clerkId);
        user = await provisionUser({
          db,
          log: request.log,
          clerkId,
          email: profile.email,
          name: profile.name,
          source: 'lazy',
        });
      }

      if (user.deletedAt !== null) {
        throw new UnauthorizedError('Account is deactivated');
      }

      request.user = { id: user.id, clerkId: user.clerkId, email: user.email };
    };

    fastify.decorate('authenticate', authenticate);
  },
  { name: 'auth' },
);

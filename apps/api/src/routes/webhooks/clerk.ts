import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Webhook } from 'svix';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { UnauthorizedError, ValidationError } from '../../lib/errors.js';
import * as userRepo from '../../repositories/user.repo.js';
import { logAudit } from '../../services/audit.service.js';
import { provisionUser } from '../../services/user.service.js';

// --- Zod schema cho payload Clerk (boundary). Chi lay field can dung. ---
const emailAddressSchema = z.object({
  id: z.string(),
  email_address: z.string(),
});

const userDataSchema = z.object({
  id: z.string(),
  email_addresses: z.array(emailAddressSchema).optional().default([]),
  primary_email_address_id: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
});
type UserData = z.infer<typeof userDataSchema>;

const deletedDataSchema = z.object({
  id: z.string(),
  deleted: z.boolean().optional(),
});

const eventSchema = z.object({
  type: z.string(),
  data: z.unknown(),
});

type SvixHeaders = Record<'svix-id' | 'svix-timestamp' | 'svix-signature', string>;

interface ClerkProfile {
  clerkId: string;
  email: string | null;
  name: string | null;
}

/** Lay email (primary -> dau tien) + ten ghep tu payload user Clerk. */
function extractProfile(data: UserData): ClerkProfile {
  const primary =
    data.email_addresses.find((e) => e.id === data.primary_email_address_id) ??
    data.email_addresses[0];
  const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
  return {
    clerkId: data.id,
    email: primary?.email_address ?? null,
    name: fullName.length > 0 ? fullName : null,
  };
}

/** Doc 3 header svix bat buoc. Thieu -> 400 (ValidationError). */
function getSvixHeaders(request: FastifyRequest): SvixHeaders {
  const id = request.headers['svix-id'];
  const timestamp = request.headers['svix-timestamp'];
  const signature = request.headers['svix-signature'];
  if (typeof id !== 'string' || typeof timestamp !== 'string' || typeof signature !== 'string') {
    throw new ValidationError('Missing svix signature headers');
  }
  return { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': signature };
}

/**
 * POST /webhooks/clerk.
 *
 * - KHONG dung `authenticate`: Clerk goi khong co JWT, ta verify chu ky svix.
 * - Idempotent: Clerk co the retry. user.created lap lai -> khong tao trung.
 * - Khong log secret / token / email o muc info.
 */
export default async function clerkWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  // Svix can RAW body de verify chu ky. Giu body o dang string trong scope nay
  // (content type parser nay chi anh huong context cua plugin, khong global).
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body);
  });

  fastify.post('/webhooks/clerk', async (request, reply) => {
    const headers = getSvixHeaders(request);

    const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
    let payload: unknown;
    try {
      payload = wh.verify(request.body as string, headers);
    } catch {
      throw new UnauthorizedError('Invalid webhook signature');
    }

    const event = eventSchema.parse(payload);
    const db = request.server.db;

    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        const profile = extractProfile(userDataSchema.parse(event.data));
        if (profile.email === null) {
          request.log.warn({ clerkId: profile.clerkId }, 'Clerk webhook user missing email, skip');
          return reply.code(200).send({ received: true, ignored: 'no_email' });
        }
        const existing = await userRepo.findByClerkId(db, profile.clerkId);
        if (existing === null) {
          await provisionUser({
            db,
            log: request.log,
            clerkId: profile.clerkId,
            email: profile.email,
            name: profile.name,
            source: 'webhook',
          });
        } else {
          await userRepo.update(db, profile.clerkId, {
            email: profile.email,
            name: profile.name,
          });
          await logAudit({
            db,
            log: request.log,
            action: 'USER_UPDATED',
            entityType: 'User',
            entityId: existing.id,
            userId: existing.id,
            metadata: { source: 'webhook', eventType: event.type },
          });
        }
        return reply.code(200).send({ received: true });
      }

      case 'user.deleted': {
        const data = deletedDataSchema.parse(event.data);
        const existing = await userRepo.findByClerkId(db, data.id);
        if (existing !== null && existing.deletedAt === null) {
          await userRepo.softDelete(db, data.id);
          await logAudit({
            db,
            log: request.log,
            action: 'USER_DELETED',
            entityType: 'User',
            entityId: existing.id,
            userId: existing.id,
            metadata: { source: 'webhook' },
          });
        }
        return reply.code(200).send({ received: true });
      }

      default:
        request.log.debug({ type: event.type }, 'Unhandled Clerk webhook event');
        return reply.code(200).send({ received: true, ignored: event.type });
    }
  });
}

# Credit System

Credits gate the paid-feeling actions (generation) and are earned through onboarding and growth loops. Source of truth for the numbers below is `@atomic-me/shared` (`constants/credits.ts`); this doc explains intent.

## Cost table (spend)

| Action                | Cost | Constant                 |
| --------------------- | ---- | ------------------------ |
| Generate CV           | 5    | `COST_PER_CV_GENERATION` |
| Generate cover letter | 3    | `COST_PER_COVER_LETTER`  |

Spend is recorded as a negative `CreditTransaction` with `reason` `GENERATION_CV` or `GENERATION_COVER_LETTER` and a `referenceId` pointing at the `Generation`.

## Earn rules

| Action                                 | Reward | Constant                  |
| -------------------------------------- | ------ | ------------------------- |
| Sign up                                | 20     | `SIGNUP_BONUS`            |
| Refer someone (inviter, once verified) | 15     | `REFERRAL_INVITER_REWARD` |
| Accept an invite (invitee)             | 10     | `REFERRAL_INVITEE_REWARD` |
| Verified social share                  | 5      | `SOCIAL_SHARE_REWARD`     |

Earn is recorded as a positive `CreditTransaction` with the matching `reason`.

## Anti-abuse

- **Daily earn cap**: a user can earn at most `MAX_DAILY_EARN` (50) credits per day across all earn actions. Earn beyond the cap is rejected before any balance mutation.
- **Referral idempotency**: a referral pays the inviter reward exactly once, and only when the referral reaches `VERIFIED` status. `VERIFIED` requires the invitee to have uploaded at least one asset that parsed successfully, so empty signups do not pay out. The unique `Referral.code` and the `PENDING -> ACCEPTED -> VERIFIED` state machine prevent double-claims.
- **Share verification**: a social share only pays out when the tracked link is clicked and the user returns to the app (not on share-button click alone).
- **Audit trail**: every credit mutation writes both a `CreditTransaction` (with `balanceAfter` snapshot for reconciliation) and, for sensitive paths, an `AuditLog` entry. Balance changes are transactional with the transaction insert so they can never drift.

## Balance model

`CreditBalance` holds the running `balance` plus `lifetimeEarned` / `lifetimeSpent` for analytics. It is updated in the same database transaction that inserts the `CreditTransaction`, and `balanceAfter` on the transaction must equal the new `balance`.

## Refund policy

- A failed generation (model error, validation failure) is refunded automatically: a positive `CreditTransaction` with `reason` `REFUND` and `referenceId` of the failed `Generation`.
- Refunds are idempotent per `Generation`: a given generation can be refunded at most once.
- Refunds do not count against `MAX_DAILY_EARN`.

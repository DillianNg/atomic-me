/**
 * Credit cost cho moi loai generation (tru vao balance khi user dung).
 */
export const COST_PER_CV_GENERATION = 5;
export const COST_PER_COVER_LETTER = 3;

/**
 * Credit thuong cho cac hanh dong earn.
 */
export const SIGNUP_BONUS = 20;
export const REFERRAL_INVITER_REWARD = 15;
export const REFERRAL_INVITEE_REWARD = 10;
export const SOCIAL_SHARE_REWARD = 5;

/**
 * Tran credit earn moi ngay (anti-abuse, ngan farm credit).
 */
export const MAX_DAILY_EARN = 50;

/**
 * Bang cost gom lai, tien tra cuu trong service layer.
 */
export const CREDIT_COSTS = {
  CV_GENERATION: COST_PER_CV_GENERATION,
  COVER_LETTER: COST_PER_COVER_LETTER,
} as const;

/**
 * Bang reward gom lai theo loai hanh dong earn.
 */
export const CREDIT_REWARDS = {
  SIGNUP_BONUS,
  REFERRAL_INVITER_REWARD,
  REFERRAL_INVITEE_REWARD,
  SOCIAL_SHARE_REWARD,
} as const;

const hasActivePremium = (user, now = Date.now()) => {
  if (!user?.isPremium) return false;
  if (!user.premiumExpiresAt) return true;

  const expiresAt = new Date(user.premiumExpiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
};

module.exports = { hasActivePremium };

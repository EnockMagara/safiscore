module.exports = {
  secret: process.env.JWT_SECRET || 'dev-fallback-secret',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-fallback-refresh',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshExpiresIn: '30d',
};

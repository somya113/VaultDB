// Load environment variables for JWT secret resolution.
require('dotenv').config();

// Import JWT verification support.
const jwt = require('jsonwebtoken');

// Authenticate requests carrying a signed Bearer token.
const authenticateToken = (req, res, next) => {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication token is required.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'vaultdb_secret_key');
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
};

// Export the middleware under a descriptive name.
module.exports = authenticateToken;

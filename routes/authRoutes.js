// Load environment configuration for JWT signing.
require('dotenv').config();

// Import route, hashing, token, and database dependencies.
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/postgres');

// Create an isolated authentication router.
const router = express.Router();

// Return only fields safe for client responses.
const profile = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role, assigned_tables: user.assigned_tables });

// Register a new reader account with a securely hashed password.
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'reader', assigned_tables = [] } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, and password are required.' });
    if (!['admin', 'writer', 'reader'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, assigned_tables) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, assigned_tables',
      [name, email, passwordHash, role, assigned_tables],
    );
    return res.status(201).json({ user: profile(result.rows[0]) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Email is already registered.' });
    console.error('Registration failed:', error);
    return res.status(500).json({ error: 'Registration failed.' });
  }
});

// Validate credentials and issue a signed access token.
router.post('/login', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [req.body.email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(req.body.password || '', user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const safeUser = profile(user);
    const token = jwt.sign(safeUser, process.env.JWT_SECRET || 'vaultdb_secret_key', { expiresIn: '8h' });
    return res.json({ token, user: safeUser });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

// Export the authentication router.
module.exports = router;

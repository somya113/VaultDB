const express = require('express');

const verifyToken = require('../middleware/authMiddleware');

const { readAuditLogs, getAuditStats } = require('../config/immudb');


const router = express.Router();


function getFilters(query) {
  return {
    user_email: query.user_email,
    table_accessed: query.table_accessed,
    date_from: query.date_from,
    date_to: query.date_to,
    is_sensitive: query.is_sensitive,
    page: query.page,
    limit: query.limit,
  };
}


router.get('/logs', verifyToken, (req, res) => {
  try {
    return res.json(readAuditLogs(getFilters(req.query)));
  } catch (error) {
    console.error('Reading audit logs failed:', error);
    return res.status(500).json({ error: 'Unable to read audit logs.' });
  }
});


router.get('/stats', verifyToken, (req, res) => {
  try {
    return res.json(getAuditStats());
  } catch (error) {
    console.error('Reading audit statistics failed:', error);
    return res.status(500).json({ error: 'Unable to read audit statistics.' });
  }
});


router.get('/user/:email', verifyToken, (req, res) => {
  const requestedEmail = req.params.email;
  if (req.user.role !== 'admin' && req.user.email.toLowerCase() !== requestedEmail.toLowerCase()) {
    return res.status(403).json({ error: 'You may only view your own audit history.' });
  }
  try {
    const result = readAuditLogs({ ...getFilters(req.query), user_email: requestedEmail });
    return res.json(result);
  } catch (error) {
    console.error('Reading user audit history failed:', error);
    return res.status(500).json({ error: 'Unable to read user audit history.' });
  }
});


module.exports = router;

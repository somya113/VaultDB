require('dotenv').config();


const express = require('express');
const cors = require('cors');


const auditLogger = require('./middleware/auditLogger');
const authRoutes = require('./routes/authRoutes');
const financeRoutes = require('./routes/financeRoutes');
const auditRoutes = require('./routes/auditRoutes');
const exportRoutes = require('./routes/exportRoutes');


const app = express();


app.use(cors());


app.use(express.json());


app.use(express.static('public'));


app.use(auditLogger);


app.use('/api/auth', authRoutes);


app.use('/api/finance', financeRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'VaultDB' }));

if (require.main === module) {
  const { getAuditStats } = require('./config/immudb');
  const { seed } = require('./scripts/seedData');
  if (getAuditStats().total_logs === 0) {
    console.log('Seeding initial benchmark audit ledger entries...');
    seed();
  }
  const port = Number(process.env.PORT || 5000);
  app.listen(port, () => console.log(`VaultDB server listening on port ${port}.`));
}


module.exports = app;

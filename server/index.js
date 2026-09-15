import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import customerRoutes from './routes/customers.js';
import dailyLogRoutes from './routes/dailyLogs.js';
import billingRoutes from './routes/billing.js';
import paymentRoutes from './routes/payments.js';
import settingRoutes from './routes/settings.js';
import dashboardRoutes from './routes/dashboard.js';
import leaveRoutes from './routes/leaves.js';
import closedDayRoutes from './routes/closedDays.js';
import backupRoutes from './routes/backup.js';
import reportRoutes from './routes/reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(compression());
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/customers', customerRoutes);
app.use('/api/daily-logs', dailyLogRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/closed-days', closedDayRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Adarsh Tiffin Management System API Server running smoothly' });
});

// Serve static React frontend files in production
const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));

// Fallback to React index.html for client-side SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'));
});

// Initialize database and start server
initDb()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`\n=================================================`);
      console.log(`🚀 Adarsh Tiffin Server running on http://localhost:${PORT}`);
      console.log(`=================================================\n`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`\n⚠️ Port ${PORT} is already in use by a running server instance.`);
        console.log(`The server API is active on http://localhost:${PORT}\n`);
      } else {
        console.error('Server error:', err);
      }
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
  });

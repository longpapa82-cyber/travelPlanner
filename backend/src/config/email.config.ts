import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.SMTP_FROM || 'noreply@travelplanner.com',
  frontendUrl: process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://mytravel-planner.com' : 'http://localhost:8081'),
}));

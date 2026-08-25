import type { FastifyInstance } from 'fastify';
import { getDashboard } from '../services/dashboard.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/dashboard', { preHandler: app.requireAuth }, async (request) => ({
    dashboard: await getDashboard(request.user!),
  }));
}

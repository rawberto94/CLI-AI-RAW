import express from 'express';
import { FastifyInstance } from 'fastify';
import templateRoutes from '../../routes/templates';
import authRoutes from '../../routes/auth';

export default async function (fastify: FastifyInstance) {
  const app = express();

  app.use('/api/templates', templateRoutes);
  app.use('/api/auth', authRoutes);

  fastify.use(app);
}

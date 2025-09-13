import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from 'clients-db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export default async function (fastify: FastifyInstance) {
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password, roleName } = request.body as any;

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    let role = await prisma.role.findUnique({ where: { name: roleName || 'user' } });
    if (!role) {
        role = await prisma.role.create({ data: { name: roleName || 'user' } });
    }

    try {
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          roleId: role.id,
        },
      });
      const { password: _, ...userWithoutPassword } = user;
      return reply.code(201).send(userWithoutPassword);
    } catch (error) {
      return reply.code(409).send({ error: 'User with this email already exists' });
    }
  });

  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '1h',
    });

    return { token };
  });
}

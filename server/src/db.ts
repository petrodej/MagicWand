import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const dbPath = path.resolve(import.meta.dirname, '../prisma/pulse.db');

const adapter = new PrismaLibSql({ url: `file:${dbPath}` });

export const prisma = new PrismaClient({ adapter });

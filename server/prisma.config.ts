import path from 'path';
import { defineConfig } from 'prisma/config';

const dbPath = path.resolve(import.meta.dirname, 'prisma/magicwand.db');

export default defineConfig({
  schema: path.resolve(import.meta.dirname, 'prisma/schema.prisma'),
  datasource: {
    url: `file:${dbPath}`,
  },
});

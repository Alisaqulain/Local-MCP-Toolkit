import { getEnv } from '../config/env.js';
import { closeDatabase, openDatabase } from './database.js';
import { logger } from '../logging/logger.js';

const env = getEnv();
openDatabase(env.databaseAbsolute);
logger.info({ path: env.databaseAbsolute }, 'Database migrated');
closeDatabase();

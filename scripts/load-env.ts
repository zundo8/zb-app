import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env variables from root .env.production first, fallback to .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

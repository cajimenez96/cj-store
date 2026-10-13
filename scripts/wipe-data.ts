import dotenv from 'dotenv';
import path from 'path';

const envFile = process.env.ENV_FILE || '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cj-store';

async function wipeDatabase() {
  console.log(`Connecting to MongoDB at: ${MONGODB_URI}`);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected successfully.');

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database handle is undefined');
  }

  const collections = await db.listCollections().toArray();
  console.log(`Found ${collections.length} collections:`);

  for (const col of collections) {
    const colName = col.name;
    if (colName === 'users') {
      const userCount = await db.collection(colName).countDocuments();
      console.log(`- PRESERVING collection "${colName}" (${userCount} documents retained)`);
    } else {
      const count = await db.collection(colName).countDocuments();
      await db.collection(colName).deleteMany({});
      console.log(`- WIPED collection "${colName}" (${count} documents removed)`);
    }
  }

  console.log('\nDatabase cleanup complete. Only users collection preserved.');
  await mongoose.disconnect();
}

wipeDatabase().catch((err) => {
  console.error('Error wiping database:', err);
  process.exit(1);
});

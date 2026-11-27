import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { EJSON } from 'bson';
import { createClient, dbName } from './config.js';

const outputRoot = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.resolve('backups', `${dbName}_${new Date().toISOString().slice(0, 10)}`);

const client = createClient();
await client.connect();
const database = client.db(dbName);
const collections = await database.listCollections({}, { nameOnly: false }).toArray();
const manifest = {
  format: 'MongoDB Extended JSON Lines',
  database: dbName,
  createdAt: new Date(),
  collections: [],
};

try {
  await mkdir(outputRoot, { recursive: true });

  for (const info of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    const collection = database.collection(info.name);
    const documents = await collection.find({}).sort({ _id: 1 }).toArray();
    const indexes = await collection.indexes();
    const data = documents.map((document) => EJSON.stringify(document, { relaxed: false })).join('\n');

    await writeFile(path.join(outputRoot, `${info.name}.jsonl`), data ? `${data}\n` : '', 'utf8');
    await writeFile(
      path.join(outputRoot, `${info.name}.metadata.json`),
      EJSON.stringify({ options: info.options ?? {}, indexes }, { relaxed: false, indent: 2 }),
      'utf8',
    );

    manifest.collections.push({ name: info.name, documents: documents.length, indexes: indexes.length });
  }

  await writeFile(
    path.join(outputRoot, 'manifest.json'),
    EJSON.stringify(manifest, { relaxed: false, indent: 2 }),
    'utf8',
  );

  console.log(JSON.stringify({ output: outputRoot, ...manifest }, null, 2));
} finally {
  await client.close();
}

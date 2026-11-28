import { createHash } from "node:crypto";
import { EJSON } from "bson";
import { createClient, dbName } from "./config.js";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
const digest = (value) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
const client = createClient();
try {
  await client.connect();
  const db = client.db(dbName);
  const snapshot = {};
  for (const name of [
    "customers",
    "movies",
    "rooms",
    "showtimes",
    "showtime_seats",
    "bookings",
  ]) {
    const info = await db.listCollections({ name }).next();
    if (!info) throw new Error(`Missing collection: ${name}`);
    const documents = await db
      .collection(name)
      .find({})
      .sort({ _id: 1 })
      .toArray();
    const indexes = await db.collection(name).indexes();
    snapshot[name] = {
      count: documents.length,
      data: digest(EJSON.serialize(documents, { relaxed: false })),
      structure: digest(
        EJSON.serialize({ options: info.options, indexes }, { relaxed: false }),
      ),
      options: EJSON.serialize(info.options, { relaxed: false }),
      indexes,
    };
  }
  console.log(
    JSON.stringify(
      {
        database: dbName,
        fingerprint: digest(snapshot),
        collections: snapshot,
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}

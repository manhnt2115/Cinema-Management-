const idString = { bsonType: 'string', minLength: 1, maxLength: 100 };
const nullableDate = { bsonType: ['date', 'null'] };
const nullableId = { bsonType: ['string', 'null'] };

export const validators = {
  customers: { $jsonSchema: { bsonType: 'object', required: ['_id', 'fullName', 'email', 'createdAt'], properties: {
    _id: idString, fullName: { bsonType: 'string', minLength: 1, maxLength: 120 },
    email: { bsonType: 'string', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', maxLength: 254 }, createdAt: { bsonType: 'date' }
  } } },
  movies: { $jsonSchema: { bsonType: 'object', required: ['_id', 'title', 'genres', 'durationMinutes', 'status', 'synopsis'], properties: {
    _id: idString, title: { bsonType: 'string', minLength: 1, maxLength: 160 },
    genres: { bsonType: 'array', minItems: 1, uniqueItems: true, items: { bsonType: 'string', minLength: 1, maxLength: 60 } },
    durationMinutes: { bsonType: 'int', minimum: 1, maximum: 600 }, status: { enum: ['NOW_SHOWING', 'COMING_SOON'] },
    synopsis: { bsonType: 'string', maxLength: 2000 }, posterImage: { bsonType: 'string', maxLength: 1500000 }
  } } },
  rooms: { $jsonSchema: { bsonType: 'object', required: ['_id', 'name', 'seats'], properties: {
    _id: idString, name: { bsonType: 'string', minLength: 1, maxLength: 100 }, seats: { bsonType: 'array', minItems: 1, items: {
      bsonType: 'object', required: ['code', 'row', 'number', 'type'], properties: {
        code: { bsonType: 'string', minLength: 1, maxLength: 10 }, row: { bsonType: 'string', minLength: 1, maxLength: 4 },
        number: { bsonType: 'int', minimum: 1 }, type: { enum: ['STANDARD', 'PREMIUM'] }
      }
    } }
  } } },
  showtimes: { $jsonSchema: { bsonType: 'object', required: ['_id', 'movieId', 'roomId', 'startAt', 'endAt', 'basePriceVnd', 'status'], properties: {
    _id: idString, movieId: idString, roomId: idString, startAt: { bsonType: 'date' }, endAt: { bsonType: 'date' },
    basePriceVnd: { bsonType: ['int', 'long'], minimum: 0 }, status: { enum: ['OPEN', 'CLOSED'] }
  } } },
  showtime_seats: { $jsonSchema: { bsonType: 'object', required: ['_id', 'showtimeId', 'seatCode', 'status', 'bookingId', 'holdExpiresAt'], properties: {
    _id: idString, showtimeId: idString, seatCode: { bsonType: 'string', minLength: 1, maxLength: 10 },
    status: { enum: ['AVAILABLE', 'HELD', 'BOOKED'] }, bookingId: nullableId, holdExpiresAt: nullableDate
  } } },
  bookings: { $jsonSchema: { bsonType: 'object', required: ['_id', 'customerId', 'showtimeId', 'movieId', 'seats', 'totalAmountVnd', 'status', 'payment', 'createdAt'], properties: {
    _id: idString, customerId: idString, showtimeId: idString, movieId: idString,
    seats: { bsonType: 'array', minItems: 1, items: { bsonType: 'object', required: ['seatCode', 'unitPriceVnd'], properties: {
      seatCode: { bsonType: 'string', minLength: 1, maxLength: 10 }, unitPriceVnd: { bsonType: ['int', 'long'], minimum: 0 }
    } } }, totalAmountVnd: { bsonType: ['int', 'long'], minimum: 0 }, status: { enum: ['PENDING', 'CONFIRMED', 'CANCELLED'] },
    payment: { bsonType: 'object', required: ['method', 'status', 'paidAt'], properties: {
      method: { enum: ['SIMULATED'] }, status: { enum: ['PENDING', 'SUCCESS', 'FAILED'] }, paidAt: nullableDate, failedAt: { bsonType: 'date' }
    } }, cancellation: { bsonType: 'object', required: ['reason', 'cancelledAt', 'refund'], properties: {
      reason: { enum: ['CUSTOMER_REQUEST'] }, cancelledAt: { bsonType: 'date' }, refund: { bsonType: 'object', required: ['method', 'status', 'refundedAt'], properties: {
        method: { enum: ['SIMULATED'] }, status: { enum: ['SUCCESS'] }, refundedAt: { bsonType: 'date' }
      } }
    } }, createdAt: { bsonType: 'date' }
  } } }
};

export async function ensureCollectionsAndValidators(db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));
  for (const [name, validator] of Object.entries(validators)) {
    if (existing.has(name)) await db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error' });
    else await db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' });
  }
}

export async function ensureIndexes(db) {
  await db.collection('customers').createIndex({ email: 1 }, { unique: true });
  await db.collection('showtimes').createIndex({ movieId: 1, startAt: 1 });
  await db.collection('bookings').createIndex({ customerId: 1, createdAt: -1 });
  await db.collection('showtime_seats').createIndex({ showtimeId: 1, seatCode: 1 }, { unique: true });
  await db.collection('showtimes').createIndex({ roomId: 1, startAt: 1, endAt: 1 });
  await db.collection('bookings').createIndex({ showtimeId: 1, status: 1 });
}

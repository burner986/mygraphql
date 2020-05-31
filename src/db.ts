import { MongoClient } from 'mongodb'

export default async function () {
  try {
    const mongoClient = await MongoClient.connect("mongodb://localhost:27017", { useNewUrlParser: true, useUnifiedTopology: true });
    const database = await mongoClient.db("playNest");
    return database;
  } catch (error) {
    return null;
  }
};

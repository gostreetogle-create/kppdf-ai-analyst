import mongoose from 'mongoose';

export async function connectMongo(uri: string): Promise<void> {
  await mongoose.connect(uri);
  console.log('[mongo] connected');
}

export function isMongoReady(): boolean {
  return mongoose.connection.readyState === 1;
}

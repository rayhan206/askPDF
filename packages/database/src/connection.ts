import mongoose from "mongoose";

export async function connectDatabase(uri: string): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 20, minPoolSize: 2 });
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

export function databaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

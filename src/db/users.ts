import { db } from './index.ts';
import { users, storeData } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
        displayName: displayName || email.split('@')[0],
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName || email.split('@')[0],
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Database user upsert failed:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

export async function saveStoreDataToPostgres(storeId: string, payload: any) {
  try {
    const result = await db.insert(storeData)
      .values({
        storeId,
        payload,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: storeData.storeId,
        set: {
          payload,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error("Failed to save store data to PostgreSQL:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

export async function getStoreDataFromPostgres(storeId: string) {
  try {
    const rows = await db.select().from(storeData).where(eq(storeData.storeId, storeId));
    return rows[0] || null;
  } catch (error) {
    console.error("Failed to get store data from PostgreSQL:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

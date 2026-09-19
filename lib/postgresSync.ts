import { AppData } from '../types';

export async function saveToPostgresCloud(data: AppData, storeId: string = 'store_xaysimo'): Promise<boolean> {
  try {
    const res = await fetch('/api/sql/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId,
        data,
      }),
    });
    if (!res.ok) {
      return false;
    }
    const json = await res.json();
    return json.success === true;
  } catch (err) {
    return false;
  }
}

export async function fetchFromPostgresCloud(storeId: string = 'store_xaysimo'): Promise<AppData | null> {
  try {
    const res = await fetch(`/api/sql/store/${storeId}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && json.data) {
      return json.data as AppData;
    }
    return null;
  } catch (err) {
    return null;
  }
}

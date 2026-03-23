import { projectId, publicAnonKey } from '/utils/supabase/info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-c093f2ae`;

const headers = {
  'Authorization': `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json'
};

export const get = async (key: string): Promise<any> => {
  const response = await fetch(`${SERVER_URL}/kv/get?key=${encodeURIComponent(key)}`, { headers });
  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return result.data;
};

export const set = async (key: string, value: any): Promise<void> => {
  const response = await fetch(`${SERVER_URL}/kv/set`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ key, value })
  });
  const result = await response.json();
  if (result.error) throw new Error(result.error);
};

export const del = async (key: string): Promise<void> => {
  const response = await fetch(`${SERVER_URL}/kv/del?key=${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers
  });
  const result = await response.json();
  if (result.error) throw new Error(result.error);
};

export const getByPrefix = async (prefix: string): Promise<any[]> => {
  const response = await fetch(`${SERVER_URL}/kv/getByPrefix?prefix=${encodeURIComponent(prefix)}`, { headers });
  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return result.data || [];
};

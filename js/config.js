import { api } from './api.js';

let cache = null;
export async function getConfig() {
  if (!cache) cache = await api.config();
  return cache;
}
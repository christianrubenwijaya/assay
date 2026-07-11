// Persistensi rating -- JSON file di repo (data/ratings.json), bukan database. Sesuai
// constraint budget Season 0 (<$50, no infra). Commit file ini ke git = riwayat rating
// otomatis ke-track lewat git log (audit gratis).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface MatchHistoryEntry {
  ts: string; opponent: string; brief: string; outcome: "win" | "loss" | "draw" | "double_forfeit";
  ratingBefore: number; ratingAfter: number; k: number;
}
export interface PlayerRecord {
  id: string; rating: number; games: number; wins: number; losses: number; draws: number;
  history: MatchHistoryEntry[];
}
export type RatingStore = Record<string, PlayerRecord>;

export function loadStore(path: string): RatingStore {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8"));
}

export function saveStore(path: string, store: RatingStore): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(store, null, 2));
}

export function getOrCreate(store: RatingStore, id: string, initialRating: number): PlayerRecord {
  if (!store[id]) store[id] = { id, rating: initialRating, games: 0, wins: 0, losses: 0, draws: 0, history: [] };
  return store[id];
}

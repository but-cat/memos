import { getDB, type DrizzleDB } from "../utils/db";
import { Cache } from "./cache";
import type { User, UserSettingRow, InstanceSettingRow } from "./types";

export class Store {
  readonly db: DrizzleDB;
  readonly userCache: Cache<User>;
  readonly userSettingCache: Cache<UserSettingRow[]>;
  readonly instanceSettingCache: Cache<InstanceSettingRow>;

  constructor(db: DrizzleDB) {
    this.db = db;
    this.userCache = new Cache<User>(10 * 60 * 1000);
    this.userSettingCache = new Cache<UserSettingRow[]>(10 * 60 * 1000);
    this.instanceSettingCache = new Cache<InstanceSettingRow>(10 * 60 * 1000);
  }
}

let _store: Store | null = null;

export function createStore(): Store {
  const db = getDB();
  return new Store(db);
}

export function getStore(): Store {
  if (!_store) {
    _store = createStore();
  }
  return _store;
}

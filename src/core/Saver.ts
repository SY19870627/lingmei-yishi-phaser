import type { WorldStateData } from './Types';
import type { WorldState } from './WorldState';

export interface SaveSlotInfo {
  slot: number;
  exists: boolean;
  name: string;
  lastSavedAt?: number | null;
}

export interface SaveSystem {
  save(slot: number): Promise<void>;
  load(slot: number): Promise<boolean>;
  getSlotInfo(slot: number): Promise<SaveSlotInfo>;
  getWorld(): WorldState | undefined;
}

type SavePayload = {
  world: WorldStateData;
};

function cloneWorldData(data: WorldStateData): WorldStateData {
  return JSON.parse(JSON.stringify(data)) as WorldStateData;
}

export class LocalStorageSaver implements SaveSystem {
  private readonly world: WorldState;
  private readonly storage: Storage | null;
  private readonly namespace: string;

  constructor(world: WorldState, storage?: Storage | null, namespace = 'yishi') {
    this.world = world;
    this.storage =
      storage !== undefined
        ? storage
        : typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : null;
    this.namespace = namespace;
  }

  getWorld(): WorldState | undefined {
    return this.world;
  }

  async save(slot: number): Promise<void> {
    if (!this.storage) {
      return;
    }

    const payload: SavePayload = {
      world: this.world.snapshot ? this.world.snapshot() : cloneWorldData(this.world.data)
    };

    this.storage.setItem(this.keyFor(slot), JSON.stringify(payload));
  }

  async load(slot: number): Promise<boolean> {
    if (!this.storage) {
      return false;
    }

    const raw = this.storage.getItem(this.keyFor(slot));
    if (!raw) {
      return false;
    }

    try {
      const payload = JSON.parse(raw) as SavePayload;
      if (!payload || !payload.world) {
        return false;
      }

      if (this.world.loadFrom) {
        this.world.loadFrom(payload.world);
      } else {
        this.world.data = cloneWorldData(payload.world);
      }
      return true;
    } catch (error) {
      console.error('解析存檔失敗', error);
      return false;
    }
  }

  async getSlotInfo(slot: number): Promise<SaveSlotInfo> {
    if (!this.storage) {
      return {
        slot,
        exists: false,
        name: this.getSlotName(slot)
      };
    }

    const raw = this.storage.getItem(this.keyFor(slot));
    if (!raw) {
      return {
        slot,
        exists: false,
        name: this.getSlotName(slot)
      };
    }

    try {
      const payload = JSON.parse(raw) as SavePayload;
      const lastSavedAt = payload?.world?.旗標?.lastSavedAt ?? null;
      return {
        slot,
        exists: true,
        name: this.getSlotName(slot),
        lastSavedAt: typeof lastSavedAt === 'number' ? lastSavedAt : null
      };
    } catch (error) {
      console.error('讀取存檔資訊失敗', error);
      return {
        slot,
        exists: false,
        name: this.getSlotName(slot)
      };
    }
  }

  private keyFor(slot: number): string {
    return `${this.namespace}:slot:${slot}`;
  }

  private getSlotName(slot: number): string {
    return `槽 ${slot + 1}`;
  }
}


import Phaser from 'phaser';
import type { WorldState } from './WorldState';

export interface GameSettingsData {
  textSpeed: number;
  softenLanguage: boolean;
  offlineMode: boolean;
}

export const DEFAULT_TEXT_SPEED = 18;
export const MIN_TEXT_SPEED = 6;
export const MAX_TEXT_SPEED = 80;

const DEFAULT_SETTINGS: GameSettingsData = {
  textSpeed: DEFAULT_TEXT_SPEED,
  softenLanguage: false,
  offlineMode: false
};

export type GameSettingsChangeEvent =
  | { type: 'textSpeed'; value: number }
  | { type: 'softenLanguage'; value: boolean }
  | { type: 'offlineMode'; value: boolean };

export class GameSettings extends Phaser.Events.EventEmitter {
  private readonly storage: Storage | null;
  private readonly key: string;
  private data: GameSettingsData = { ...DEFAULT_SETTINGS };

  constructor(storage?: Storage | null, key = 'yishi:settings') {
    super();
    if (storage !== undefined) {
      this.storage = storage;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this.storage = window.localStorage;
    } else {
      this.storage = null;
    }
    this.key = key;
  }

  async load(): Promise<void> {
    if (!this.storage) {
      return;
    }

    const raw = this.storage.getItem(this.key);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<GameSettingsData>;
      this.data = {
        ...DEFAULT_SETTINGS,
        ...parsed
      };
      this.data.textSpeed = Math.round(
        Math.min(Math.max(this.data.textSpeed ?? DEFAULT_TEXT_SPEED, MIN_TEXT_SPEED), MAX_TEXT_SPEED)
      );
      this.data.softenLanguage = Boolean(this.data.softenLanguage);
      this.data.offlineMode = Boolean(this.data.offlineMode);
    } catch (error) {
      console.error('讀取設定失敗', error);
      this.data = { ...DEFAULT_SETTINGS };
    }
  }

  save(): void {
    if (!this.storage) {
      return;
    }

    try {
      this.storage.setItem(this.key, JSON.stringify(this.data));
    } catch (error) {
      console.error('儲存設定失敗', error);
    }
  }

  getSnapshot(): GameSettingsData {
    return { ...this.data };
  }

  getTextSpeed(): number {
    return this.data.textSpeed;
  }

  setTextSpeed(speed: number, persist = true): void {
    const clamped = Math.round(Math.min(Math.max(speed, MIN_TEXT_SPEED), MAX_TEXT_SPEED));
    if (clamped === this.data.textSpeed) {
      if (persist) {
        this.save();
      }
      return;
    }
    this.data.textSpeed = clamped;
    if (persist) {
      this.save();
    }
    this.emitChange({ type: 'textSpeed', value: clamped });
  }

  isSoftLanguageEnabled(): boolean {
    return this.data.softenLanguage;
  }

  setSoftLanguage(enabled: boolean, persist = true): void {
    if (enabled === this.data.softenLanguage) {
      if (persist) {
        this.save();
      }
      return;
    }
    this.data.softenLanguage = enabled;
    if (persist) {
      this.save();
    }
    this.emitChange({ type: 'softenLanguage', value: enabled });
  }

  isOfflineMode(): boolean {
    return this.data.offlineMode;
  }

  setOfflineMode(enabled: boolean, persist = true): void {
    if (enabled === this.data.offlineMode) {
      if (persist) {
        this.save();
      }
      return;
    }
    this.data.offlineMode = enabled;
    if (persist) {
      this.save();
    }
    this.emitChange({ type: 'offlineMode', value: enabled });
  }

  applyWorldFlags(world: WorldState): void {
    world.setFlag('offline', this.data.offlineMode);
  }

  private emitChange(event: GameSettingsChangeEvent): void {
    switch (event.type) {
      case 'textSpeed':
        this.emit('change:textSpeed', event.value);
        break;
      case 'softenLanguage':
        this.emit('change:softenLanguage', event.value);
        break;
      case 'offlineMode':
        this.emit('change:offlineMode', event.value);
        break;
      default:
        break;
    }
  }
}

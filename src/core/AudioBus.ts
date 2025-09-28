import Phaser from 'phaser';

export interface BgmPlayOptions {
  volume?: number;
  loop?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  seek?: number;
}

export interface BgmStopOptions {
  fadeOut?: number;
}

export interface SfxPlayOptions extends Phaser.Types.Sound.SoundConfig {
  fadeIn?: number;
  fadeOut?: number;
  baseVolume?: number;
}

type ChannelKind = 'bgm' | 'sfx';

interface ChannelBinding {
  sound: Phaser.Sound.BaseSound;
  group: ChannelKind;
  baseVolume: number;
  targetVolume: number;
}

interface FadeJob {
  channel: ChannelBinding;
  from: number;
  to: number;
  duration: number;
  startTime: number;
  resolve: () => void;
}

const DEFAULT_FADE = 350;

export class AudioBus {
  private readonly sound: Phaser.Sound.BaseSoundManager;
  private readonly gameEvents: Phaser.Events.EventEmitter;
  private readonly fadeJobs = new Map<ChannelBinding, FadeJob>();
  private readonly channels = new Set<ChannelBinding>();
  private masterVolume = 1;
  private bgmVolume = 1;
  private sfxVolume = 1;
  private bgmChannel?: ChannelBinding;
  private bgmKey?: string;
  private disposed = false;

  constructor(sound: Phaser.Sound.BaseSoundManager) {
    this.sound = sound;
    this.sound.pauseOnBlur = false;
    this.gameEvents = sound.game.events;
    this.gameEvents.on(Phaser.Core.Events.STEP, this.update, this);
    this.gameEvents.once(Phaser.Core.Events.DESTROY, this.dispose, this);
  }

  get activeBgm(): string | undefined {
    return this.bgmKey;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Phaser.Math.Clamp(volume, 0, 1);
    this.refreshAllVolumes();
  }

  setBgmVolume(volume: number): void {
    this.bgmVolume = Phaser.Math.Clamp(volume, 0, 1);
    this.refreshAllVolumes('bgm');
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Phaser.Math.Clamp(volume, 0, 1);
    this.refreshAllVolumes('sfx');
  }

  async playBgm(key: string, options: BgmPlayOptions = {}): Promise<void> {
    const volume = Phaser.Math.Clamp(options.volume ?? 1, 0, 1);
    const fadeIn = Math.max(options.fadeIn ?? DEFAULT_FADE, 0);
    const fadeOut = Math.max(options.fadeOut ?? DEFAULT_FADE, 0);
    const loop = options.loop ?? true;
    const seek = options.seek ?? 0;

    if (this.bgmChannel && this.bgmKey === key) {
      this.bgmChannel.targetVolume = volume;
      if (fadeIn > 0) {
        await this.scheduleFade(this.bgmChannel, volume, fadeIn);
      } else {
        this.bgmChannel.baseVolume = volume;
        this.applyChannelVolume(this.bgmChannel);
      }
      return;
    }

    const previous = this.bgmChannel;
    const previousKey = this.bgmKey;

    if (previous) {
      await this.fadeDownAndStop(previous, fadeOut);
      if (previousKey) {
        this.sound.stopByKey(previousKey);
      }
    }

    const sound = this.obtainSound(key);
    sound.stop();
    sound.play({ loop, seek, volume: 0 });

    const channel: ChannelBinding = {
      sound,
      group: 'bgm',
      baseVolume: 0,
      targetVolume: volume
    };
    this.registerChannel(channel);
    this.bgmChannel = channel;
    this.bgmKey = key;

    if (fadeIn > 0) {
      await this.scheduleFade(channel, volume, fadeIn);
    } else {
      channel.baseVolume = volume;
      this.applyChannelVolume(channel);
    }
  }

  async stopBgm(options: BgmStopOptions = {}): Promise<void> {
    if (!this.bgmChannel) {
      return;
    }
    const fadeOut = Math.max(options.fadeOut ?? DEFAULT_FADE, 0);
    const channel = this.bgmChannel;
    await this.fadeDownAndStop(channel, fadeOut);
    channel.sound.stop();
    this.unregisterChannel(channel);
    this.bgmChannel = undefined;
    this.bgmKey = undefined;
  }

  playSfx(key: string, options: SfxPlayOptions = {}): Phaser.Sound.BaseSound {
    const { fadeIn: rawFadeIn, fadeOut: rawFadeOut, baseVolume: rawBaseVolume, ...soundConfig } = options;
    const fadeIn = Math.max(rawFadeIn ?? 0, 0);
    const fadeOut = Math.max(rawFadeOut ?? 0, 0);
    const baseVolume = Phaser.Math.Clamp(rawBaseVolume ?? soundConfig.volume ?? 1, 0, 1);

    const sound = this.sound.add(key, soundConfig);
    const channel: ChannelBinding = {
      sound,
      group: 'sfx',
      baseVolume: fadeIn > 0 ? 0 : baseVolume,
      targetVolume: baseVolume
    };
    this.registerChannel(channel);

    const effectiveVolume = this.getEffectiveVolume(channel);
    sound.once(Phaser.Sound.Events.COMPLETE, () => {
      if (fadeOut > 0) {
        this.scheduleFade(channel, 0, fadeOut).finally(() => {
          sound.stop();
          this.unregisterChannel(channel);
        });
      } else {
        this.unregisterChannel(channel);
      }
    });
    sound.once(Phaser.Sound.Events.DESTROY, () => {
      this.unregisterChannel(channel);
    });

    sound.play({ ...soundConfig, volume: effectiveVolume });

    if (fadeIn > 0) {
      void this.scheduleFade(channel, baseVolume, fadeIn);
    } else {
      channel.baseVolume = baseVolume;
      this.applyChannelVolume(channel);
    }

    return sound;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.gameEvents.off(Phaser.Core.Events.STEP, this.update, this);
    this.fadeJobs.clear();
    this.channels.clear();
    this.bgmChannel = undefined;
    this.bgmKey = undefined;
  }

  private obtainSound(key: string): Phaser.Sound.BaseSound {
    const existing = this.sound.get(key);
    if (existing) {
      return existing;
    }
    return this.sound.add(key);
  }

  private registerChannel(channel: ChannelBinding): void {
    this.channels.add(channel);
    this.applyChannelVolume(channel);
  }

  private unregisterChannel(channel: ChannelBinding): void {
    this.channels.delete(channel);
    this.cancelFade(channel);
    if (this.bgmChannel === channel) {
      this.bgmChannel = undefined;
      this.bgmKey = undefined;
    }
  }

  private refreshAllVolumes(group?: ChannelKind): void {
    for (const channel of this.channels) {
      if (!group || channel.group === group) {
        this.applyChannelVolume(channel);
      }
    }
  }

  private applyChannelVolume(channel: ChannelBinding): void {
    const groupVolume = channel.group === 'bgm' ? this.bgmVolume : this.sfxVolume;
    const effective = channel.baseVolume * groupVolume * this.masterVolume;
    const sound = channel.sound as Phaser.Sound.BaseSound & {
      setVolume?: (value: number) => Phaser.Sound.BaseSound;
      volume?: number;
    };
    if (typeof sound.setVolume === 'function') {
      sound.setVolume(effective);
    } else if (typeof sound.volume === 'number') {
      sound.volume = effective;
    }
  }

  private getEffectiveVolume(channel: ChannelBinding): number {
    const groupVolume = channel.group === 'bgm' ? this.bgmVolume : this.sfxVolume;
    return channel.baseVolume * groupVolume * this.masterVolume;
  }

  private async fadeDownAndStop(channel: ChannelBinding, duration: number): Promise<void> {
    await this.scheduleFade(channel, 0, duration);
  }

  private scheduleFade(channel: ChannelBinding, target: number, duration: number): Promise<void> {
    this.cancelFade(channel);
    if (duration <= 0) {
      channel.baseVolume = target;
      this.applyChannelVolume(channel);
      return Promise.resolve();
    }

    channel.targetVolume = target;

    return new Promise((resolve) => {
      const job: FadeJob = {
        channel,
        from: channel.baseVolume,
        to: target,
        duration,
        startTime: this.sound.game.loop.time,
        resolve
      };
      this.fadeJobs.set(channel, job);
    });
  }

  private cancelFade(channel: ChannelBinding): void {
    if (!this.fadeJobs.has(channel)) {
      return;
    }
    this.fadeJobs.delete(channel);
  }

  private update(time: number): void {
    if (this.fadeJobs.size === 0) {
      return;
    }

    const now = time;
    for (const [channel, job] of [...this.fadeJobs.entries()]) {
      const elapsed = now - job.startTime;
      const progress = Phaser.Math.Clamp(job.duration <= 0 ? 1 : elapsed / job.duration, 0, 1);
      channel.baseVolume = Phaser.Math.Linear(job.from, job.to, progress);
      this.applyChannelVolume(channel);
      if (progress >= 1) {
        this.fadeJobs.delete(channel);
        job.resolve();
      }
    }
  }
}

export default AudioBus;

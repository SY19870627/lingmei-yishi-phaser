import type { GhostOption, Spirit, WordCard, WorldStateData } from './Types';
import { seedFrom, type RandomGenerator } from './Seed';
import type { GameSettings } from './Settings';
import type { ProviderAdapter } from './ProviderAdapter';
import { WebProviderAdapter } from './ProviderAdapter';

/**
 * 呼叫外部 AI 所需的上下文資料結構，包含靈體資訊、選取的字卡與世界狀態。
 */
export interface GhostOptionContext {
  spirit: Spirit;
  word: WordCard;
  world: WorldStateData;
  seed?: string;
}

/**
 * 負責統整 AI 運算管線，視設定決定採用本機隨機生成或實際呼叫 GPT API。
 */
export class AiOrchestrator {
  /** 目前選用的模式，預設為離線本機模式。 */
  mode: 'local' | 'provider' = 'local';
  private readonly settings?: GameSettings;
  private readonly providerAdapter: ProviderAdapter;

  constructor(settings?: GameSettings, providerAdapter: ProviderAdapter = new WebProviderAdapter()) {
    this.settings = settings;
    this.providerAdapter = providerAdapter;
    this.refreshMode();
  }

  /**
   * 對外提供產生靈體回應選項的統一入口，依模式決定資料來源。
   */
  async genGhostOptions(context: GhostOptionContext): Promise<{ options: GhostOption[]; tone: string }> {
    const { seed } = context;
    this.refreshMode();

    if (this.mode === 'provider') {
      const response = await this.providerAdapter.requestChatJSON(context);
      return response as { options: GhostOption[]; tone: string };
    }

    const random = this.createRandom(seed ?? '');
    const tone = this.pickTone(random);
    const options = this.buildLocalOptions(random);

    return { options, tone };
  }

  /**
   * 允許外部在設定改變時重新評估模式，例如切換離線模式時呼叫。
   */
  refreshMode(): void {
    this.mode = this.shouldUseProvider() ? 'provider' : 'local';
  }

  /**
   * 根據目前設定與 Adapter 狀態判斷是否要使用外部服務。
   */
  private shouldUseProvider(): boolean {
    if (this.settings?.isOfflineMode()) {
      return false;
    }
    return this.providerAdapter.isReady();
  }

  /**
   * 建立可重現的亂數來源，讓離線模式也能擁有穩定結果。
   */
  private createRandom(seed: string): RandomGenerator {
    return seedFrom(seed);
  }

  /**
   * 隨機挑選靈體的語氣，模擬基本的情緒變化。
   */
  private pickTone(random: RandomGenerator): string {
    const tones = ['受傷但願談', '悲傷中求助', '試圖回應'];
    const index = Math.floor(random() * tones.length);
    return tones[Math.max(0, Math.min(index, tones.length - 1))];
  }

  /**
   * 離線模式下的預設選項組合，會依據玩家設定決定是否使用柔和語氣。
   */
  private buildLocalOptions(random: RandomGenerator): GhostOption[] {
    const soften = this.settings?.isSoftLanguageEnabled() ?? false;
    const variants: Array<
      Omit<GhostOption, 'text'> & { textVariants: string[]; softenTextVariants?: string[] }
    > = [
      {
        textVariants: [
          '讓我替你把名冊找正好嗎？',
          '要不要我幫你把名冊整理正好？',
          '我可以替你把名冊整理妥當。'
        ],
        softenTextVariants: [
          '我來幫你把名冊慢慢整理好嗎？',
          '要不要我陪你把名冊一頁頁排整齊？',
          '我可以溫柔地替你把名冊整理好。'
        ],
        type: '指認',
        targets: ['e1'],
        requires: [],
        effect: '鬆動',
        hint: '碼頭管理處'
      },
      {
        textVariants: [
          '我帶王嬸的佛珠，她掛念你。',
          '王嬸託我帶來佛珠，她很想你。',
          '我拿著王嬸的佛珠，她惦記著你。'
        ],
        softenTextVariants: [
          '我帶來王嬸托付的佛珠，她一直惦記著你。',
          '王嬸請我帶著這串佛珠來，她說很想念你。',
          '我握著王嬸的佛珠，她滿心希望你能安心。'
        ],
        type: '安撫',
        targets: [],
        requires: ['it_wang_beads'],
        effect: '平煞'
      }
    ];

    const options = variants.map((variant) => {
      const pool = soften && variant.softenTextVariants?.length ? variant.softenTextVariants : variant.textVariants;
      const choice = Math.floor(random() * pool.length);
      const text = pool[Math.max(0, Math.min(choice, pool.length - 1))];
      const { textVariants: _ignored, ...rest } = variant;
      const { softenTextVariants: _ignoredSoft, ...base } = rest;
      return { ...base, text } satisfies GhostOption;
    });

    return this.shuffle(options, random);
  }

  /**
   * Fisher-Yates 演算法的變形，確保選項順序隨機但可重現。
   */
  private shuffle<T>(items: T[], random: RandomGenerator): T[] {
    const clone = [...items];
    for (let i = clone.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const index = Math.max(0, Math.min(j, i));
      const tmp = clone[i];
      clone[i] = clone[index];
      clone[index] = tmp;
    }
    return clone;
  }
}

import type { GhostOption, Spirit, WordCard, WorldStateData } from './Types';
import { seedFrom, type RandomGenerator } from './Seed';
import type { GameSettings } from './Settings';
import type { ProviderAdapter } from './ProviderAdapter';
import { WebProviderAdapter } from './ProviderAdapter';

export interface GhostOptionContext {
  spirit: Spirit;
  word: WordCard;
  world: WorldStateData;
  seed?: string;
}

export interface CompanionDialogueContext {
  spirit: Spirit;
  companionId: string;
  companionName: string;
  world: WorldStateData;
  seed?: string;
}

export class AiOrchestrator {
  mode: 'local' | 'provider' = 'local';
  private readonly settings?: GameSettings;
  private readonly providerAdapter: ProviderAdapter;

  constructor(settings?: GameSettings, providerAdapter: ProviderAdapter = new WebProviderAdapter()) {
    this.settings = settings;
    this.providerAdapter = providerAdapter;
  }

  async genGhostOptions(context: GhostOptionContext): Promise<{ options: GhostOption[]; tone: string }> {
    const { seed } = context;
    if (this.mode === 'provider') {
      const response = await this.providerAdapter.requestChatJSON(context);
      return response as { options: GhostOption[]; tone: string };
    }

    const random = this.createRandom(seed ?? '');
    const tone = this.pickTone(random);
    const options = this.buildLocalOptions(random);

    return { options, tone };
  }

  async genCompanionOptions(
    context: CompanionDialogueContext
  ): Promise<{ options: GhostOption[]; tone: string }> {
    const { seed } = context;
    if (this.mode === 'provider') {
      const response = await this.providerAdapter.requestChatJSON({ mode: 'companion', ...context });
      return response as { options: GhostOption[]; tone: string };
    }

    const random = this.createRandom(seed ?? '');
    const tone = this.pickTone(random);
    const options = this.buildCompanionLocalOptions(context, random);

    return { options, tone };
  }

  private createRandom(seed: string): RandomGenerator {
    return seedFrom(seed);
  }

  private pickTone(random: RandomGenerator): string {
    const tones = ['受傷但願談', '悲傷中求助', '試圖回應'];
    const index = Math.floor(random() * tones.length);
    return tones[Math.max(0, Math.min(index, tones.length - 1))];
  }

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

  private buildCompanionLocalOptions(
    context: CompanionDialogueContext,
    random: RandomGenerator
  ): GhostOption[] {
    const soften = this.settings?.isSoftLanguageEnabled() ?? false;
    const { companionName, spirit } = context;
    const firstObsession = spirit.執念?.[0]?.id;
    const variants: Array<
      Omit<GhostOption, 'text'> & { textVariants: string[]; softenTextVariants?: string[] }
    > = [
      {
        textVariants: [
          `${companionName}柔聲說：「我們都在，你不孤單。」`,
          `${companionName}替你守在這裡，請慢慢說。`,
          `${companionName}走上前，想安穩你的心。`
        ],
        softenTextVariants: [
          `${companionName}輕聲地說：「我們都在，慢慢來就好。」`,
          `${companionName}陪著你，語氣柔和地請你安心。`,
          `${companionName}握著你的手說：「我們會一直在這。」`
        ],
        type: '安撫',
        targets: [],
        requires: [],
        effect: '平煞'
      },
      {
        textVariants: [
          `${companionName}試著問：「還有誰讓你掛念？我們可以幫忙。」`,
          `${companionName}向你追問想牽掛的人。`,
          `${companionName}耐心詢問你心裡最重的那道結。`
        ],
        softenTextVariants: [
          `${companionName}溫柔地問：「你最放不下的是誰？我們一起想辦法。」`,
          `${companionName}輕聲詢問，想知道你牽掛的心事。`,
          `${companionName}坐在你身旁，細細問著哪個心結最痛。`
        ],
        type: '提問',
        targets: firstObsession ? [firstObsession] : [],
        requires: [],
        effect: '鬆動'
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

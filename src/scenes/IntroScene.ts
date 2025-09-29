import Phaser from 'phaser';
import { ModuleScene } from '@core/Router';
import type { Router } from '@core/Router';
import type { WorldState } from '@core/WorldState';
import type { DataRepo } from '@core/DataRepo';

const zhBase = {
  fontFamily: 'Noto Sans TC, PingFang TC, "Microsoft JhengHei", sans-serif',
  padding: { top: 6, bottom: 2 },
  color: '#fff'
} as const;

const CHARACTER_HEIGHT_RATIOS = {
  grandma: 0.7,
  youngHuiling: 0.525,
  sachet: 0.44,
  ghostSoldier: 0.65
} as const;

export default class IntroScene extends ModuleScene<void, { completed: boolean }> {
  private world?: WorldState;
  private router?: Router;
  private repo?: DataRepo;
  private skipButton?: Phaser.GameObjects.Text;
  private isFirstPlay = false;

  constructor() {
    super('IntroScene');
  }

  preload() {
    // 預載入開頭所需圖片
    this.load.image('dream-bg', 'images/intro/dream-courtyard.png');
    this.load.image('grandma', 'images/intro/grandma.png');
    this.load.image('young-huiling', 'images/intro/young-huiling.png');
    this.load.image('sachet', 'images/intro/red-sachet.png');
    this.load.image('poor-house', 'images/intro/poor-house.png');
    this.load.image('alley', 'images/intro/alley.png');
    this.load.image('ghost-soldier', 'images/intro/ghost-soldier.png');
    
    // 音效
    this.load.audio('dream-music', 'audio/dream-ambience.mp3');
    this.load.audio('crying', 'audio/child-crying.mp3');
    this.load.audio('whisper', 'audio/ghost-whisper.mp3');
  }

  create() {
    this.world = this.registry.get('world') as WorldState | undefined;
    this.router = this.registry.get('router') as Router | undefined;
    this.repo = this.registry.get('repo') as DataRepo | undefined;

    // 檢查是否為首次遊玩
    this.isFirstPlay = !this.world?.data?.旗標?.['intro_completed'];

    if (!this.isFirstPlay) {
      // 如果已經看過開頭，直接進入主選單
      this.scene.start('TitleScene');
      return;
    }

    // 建立跳過按鈕
    this.createSkipButton();

    // 開始播放開頭劇情
    void this.playIntroSequence();
  }

  private createSkipButton() {
    const { width, height } = this.scale;
    this.skipButton = this.add
      .text(width - 20, height - 20, '跳過開頭 >', {
        ...zhBase,
        fontSize: '18px',
        color: '#aaa'
      })
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.7);

    this.skipButton.on('pointerover', () => {
      this.skipButton?.setAlpha(1).setColor('#fff');
    });

    this.skipButton.on('pointerout', () => {
      this.skipButton?.setAlpha(0.7).setColor('#aaa');
    });

    this.skipButton.on('pointerup', () => {
      this.skipIntro();
    });
  }

  private async playIntroSequence() {
    try {
      // 第一幕：夢中的奶奶
      await this.playAct1Dream();
      
      // 第二幕：殘酷的現實
      await this.playAct2Reality();
      
      // 第三幕：第一次接觸
      await this.playAct3FirstContact();
      
      // 第四幕：命運的開始
      await this.playAct4Destiny();
      
      // 第五幕：新的開始（包含玩家選擇）
      await this.playAct5NewBeginning();
      
      // 第六幕：標題畫面
      await this.playAct6Title();

      // 完成開頭，標記旗標
      this.completeIntro();

    } catch (error) {
      console.error('開頭劇情播放錯誤:', error);
      this.skipIntro();
    }
  }

  private async playAct1Dream(): Promise<void> {
    const { width, height } = this.scale;
    
    // 淡入夢境背景
    const dreamBg = this.add.image(width / 2, height / 2, 'dream-bg')
      .setAlpha(0);
    
    await this.fadeIn(dreamBg, 1500);
    
    // 播放溫馨音樂
    this.sound.play('dream-music', { volume: 0.5, loop: true });
    
    // 顯示奶奶和小惠玲
    const grandma = this.fitImageToHeight(
      this.add.image(width * 0.3, height * 0.6, 'grandma'),
      CHARACTER_HEIGHT_RATIOS.grandma
    ).setAlpha(0);
    
    const youngHuiling = this.fitImageToHeight(
      this.add.image(width * 0.5, height * 0.65, 'young-huiling'),
      CHARACTER_HEIGHT_RATIOS.youngHuiling
    ).setAlpha(0);
    
    await Promise.all([
      this.fadeIn(grandma, 1000),
      this.fadeIn(youngHuiling, 1000)
    ]);
    
    // 對話序列
    await this.showDialogue('奶奶', '惠玲啊，奶奶給妳做個好東西。');
    await this.showDialogue('小惠玲', '奶奶，這是什麼？');
    
    // 顯示香包
    const sachet = this.fitImageToHeight(
      this.add.image(width * 0.4, height * 0.5, 'sachet'),
      CHARACTER_HEIGHT_RATIOS.sachet
    ).setAlpha(0);
    
    await this.fadeIn(sachet, 500);
    
    await this.showDialogue('奶奶', '這是奶奶去媽祖廟求來的平安符，縫在這個香包裡面。妳要隨身帶著，媽祖婆會保佑妳平安的。');
    await this.showDialogue('小惠玲', '真的嗎？那奶奶也會一直保佑我嗎？');
    await this.showDialogue('奶奶', '傻孩子，奶奶會永遠在妳身邊的...永遠...');
    
    // 畫面逐漸模糊
    await this.fadeOut([dreamBg, grandma, youngHuiling, sachet], 2000);
    this.sound.stopByKey('dream-music');
  }

  private async playAct2Reality(): Promise<void> {
    const { width, height } = this.scale;
    
    // 切換到破舊小屋場景
    const poorHouse = this.add.image(width / 2, height / 2, 'poor-house')
      .setAlpha(0);
    
    await this.fadeIn(poorHouse, 1000);
    
    // 播放哭泣聲
    this.sound.play('crying', { volume: 0.3 });
    
    // 顯示旁白
    await this.showNarration('6歲的蔡惠玲蜷縮在床角，臉上有淡淡的灰塵，左眼的青色胎記在昏暗光線中若隱若現。');
    
    await this.showDialogue('惠玲', '奶奶...奶奶妳在哪裡...');
    
    // 村民議論聲（畫外音）
    await this.showOffscreenVoice('村民甲', '那個查某囡仔...左眼生得那樣奇怪...');
    await this.showOffscreenVoice('村民乙', '聽說她阿嬤過世後，她就開始說看得到奇怪的東西...');
    
    await this.wait(1500);
  }

  private async playAct3FirstContact(): Promise<void> {
    const { width, height } = this.scale;
    
    // 切換到小巷場景
    this.cameras.main.fadeOut(500, 0, 0, 0);
    await this.wait(500);
    
    const alley = this.add.image(width / 2, height / 2, 'alley');
    this.cameras.main.fadeIn(500, 0, 0, 0);
    
    // 孩子們的嘲笑
    await this.showOffscreenVoice('小孩甲', '欸！菜花！菜花來了！');
    await this.showOffscreenVoice('小孩乙', '菜花！妳的眼睛怎麼那麼奇怪？');
    
    // 鬼魂出現
    const ghost = this.fitImageToHeight(
      this.add.image(width * 0.7, height * 0.5, 'ghost-soldier'),
      CHARACTER_HEIGHT_RATIOS.ghostSoldier
    )
      .setAlpha(0.5)
      .setTint(0x8888ff);
    
    // 播放鬼魂低語聲
    this.sound.play('whisper', { volume: 0.4 });
    
    await this.showDialogue('惠玲', '阿...阿伯？');
    await this.showDialogue('鬼魂', '小姑娘...妳看得到我？');
    
    // 孩子們嚇跑
    await this.showOffscreenVoice('小孩甲', '她...她在跟誰講話？');
    await this.showOffscreenVoice('小孩乙', '好可怕...我們快走！');
    
    await this.showDialogue('惠玲', '你...你是誰？');
    await this.showDialogue('鬼魂', '我...我已經死了很久了...但是我找不到回家的路...');
    await this.showDialogue('惠玲', '你...你需要幫助嗎？');
  }

  private async playAct4Destiny(): Promise<void> {
    // 顯示香包發光
    await this.showNarration('惠玲緊握著香包，左眼的胎記散發著微弱的藍光');
    
    await this.showDialogue('惠玲', '奶奶...如果妳真的還在保佑我...請告訴我該怎麼做...');
    
    // 顯示系統提示 - 第一次接觸遊戲機制
    await this.showSystemMessage('天語卡牌：「溫柔對話」已出現');
    
    await this.showDialogue('惠玲', '這是...什麼？');
    
    await this.showSystemMessage('使用天語卡牌與亡靈溝通。選擇「溫柔對話」來安撫這位迷失的靈魂。');
  }

  private async playAct5NewBeginning(): Promise<void> {
    // 玩家選擇分支
    const choice = await this.showChoice('選擇你的回應', [
      { text: '使用「溫柔對話」：「我想幫助你找到回家的路」', value: 'gentle' },
      { text: '害怕退縮：「我...我很害怕...」', value: 'fear' },
      { text: '詢問詳情：「你為什麼會迷路？」', value: 'ask' }
    ]);

    if (choice === 'gentle') {
      await this.showDialogue('惠玲', '我想幫助你找到回家的路。');
      await this.showNarration('卡牌發出溫和的光芒，鬼魂的表情變得平靜');
      await this.showDialogue('鬼魂', '謝謝妳...小姑娘...我感受到了妳的善意...');
      await this.showNarration('鬼魂化作點點光芒消散');
      
      // 奶奶的聲音
      await this.showOffscreenVoice('奶奶的聲音', '惠玲...妳做得很好...這就是妳的使命...');
      await this.showDialogue('惠玲', '奶奶...我明白了...');
      
      // 給予額外獎勵
      if (this.world) {
        this.world.data.陰德 = '中';
      }
    } else if (choice === 'fear') {
      await this.showDialogue('惠玲', '我...我很害怕...');
      await this.showDialogue('鬼魂', '沒關係的，孩子...我理解...');
      await this.showNarration('鬼魂緩緩消失在夜色中');
    } else {
      await this.showDialogue('惠玲', '你為什麼會迷路？');
      await this.showDialogue('鬼魂', '戰爭...戰爭讓我忘記了回家的路...');
      await this.showNarration('鬼魂的身影漸漸模糊');
    }
  }

  private async playAct6Title(): Promise<void> {
    const { width, height } = this.scale;
    
    // 淡出所有元素
    this.cameras.main.fadeOut(1000, 0, 0, 0);
    await this.wait(1000);
    
    // 清理場景
    this.children.removeAll();
    
    // 顯示標題
    this.cameras.main.fadeIn(1000, 0, 0, 0);
    
    const title = this.add.text(width / 2, height / 3, '天語', {
      ...zhBase,
      fontSize: '72px',
      color: '#ffd700'
    }).setOrigin(0.5);
    
    const subtitle = this.add.text(width / 2, height / 3 + 80, 'HEAVENLY WORDS', {
      ...zhBase,
      fontSize: '32px',
      color: '#fff'
    }).setOrigin(0.5);
    
    const tagline = this.add.text(width / 2, height * 0.6, '一個關於溝通、理解與救贖的故事', {
      ...zhBase,
      fontSize: '24px',
      color: '#ccc'
    }).setOrigin(0.5);
    
    // 顯示旁白
    await this.showNarration('在這個動蕩不安的年代，戰爭帶來了無數的死亡與怨念...');
    await this.showNarration('而有一個小女孩，背負著被人恐懼的天賦...');
    await this.showNarration('她將用她的「天語」，為迷失的靈魂指引歸途...');
    
    await this.wait(3000);
  }

  // === 輔助方法 ===

  private async showDialogue(speaker: string, text: string): Promise<void> {
    const { width, height } = this.scale;
    
    const dialogueBox = this.add.rectangle(width / 2, height - 100, width - 80, 150, 0x000000, 0.8)
      .setStrokeStyle(2, 0xffffff, 0.5);
    
    const speakerText = this.add.text(60, height - 160, speaker, {
      ...zhBase,
      fontSize: '20px',
      color: '#ffd54f',
      fontStyle: 'bold'
    });
    
    const dialogueText = this.add.text(60, height - 120, '', {
      ...zhBase,
      fontSize: '22px',
      wordWrap: { width: width - 120 }
    });
    
    // 逐字顯示效果
    await this.typewriterEffect(dialogueText, text);
    await this.waitForClick();
    
    // 清理
    dialogueBox.destroy();
    speakerText.destroy();
    dialogueText.destroy();
  }

  private async showNarration(text: string): Promise<void> {
    const { width, height } = this.scale;
    
    const narrationText = this.add.text(width / 2, height / 2, '', {
      ...zhBase,
      fontSize: '24px',
      align: 'center',
      wordWrap: { width: width - 160 },
      backgroundColor: '#000000aa',
      padding: { left: 20, right: 20, top: 15, bottom: 15 }
    }).setOrigin(0.5);
    
    await this.typewriterEffect(narrationText, text);
    await this.wait(2000);
    
    await this.fadeOut([narrationText], 500);
  }

  private async showOffscreenVoice(speaker: string, text: string): Promise<void> {
    const { width, height } = this.scale;
    
    const voiceText = this.add.text(width / 2, height - 200, `${speaker}：${text}`, {
      ...zhBase,
      fontSize: '20px',
      color: '#aaa',
      align: 'center',
      fontStyle: 'italic',
      wordWrap: { width: width - 120 }
    }).setOrigin(0.5);
    
    await this.wait(2500);
    await this.fadeOut([voiceText], 500);
  }

  private async showSystemMessage(text: string): Promise<void> {
    const { width, height } = this.scale;
    
    const systemBox = this.add.rectangle(width / 2, height / 2, 600, 120, 0x2a4858, 0.95)
      .setStrokeStyle(3, 0x5a8898, 1);
    
    const systemText = this.add.text(width / 2, height / 2, text, {
      ...zhBase,
      fontSize: '20px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 550 }
    }).setOrigin(0.5);
    
    await this.wait(3000);
    
    await this.fadeOut([systemBox, systemText], 500);
  }

  private async showChoice(prompt: string, options: { text: string; value: string }[]): Promise<string> {
    return new Promise((resolve) => {
      const { width, height } = this.scale;
      
      // 顯示提示
      const promptText = this.add.text(width / 2, height / 2 - 100, prompt, {
        ...zhBase,
        fontSize: '24px',
        align: 'center'
      }).setOrigin(0.5);
      
      // 顯示選項
      const optionTexts: Phaser.GameObjects.Text[] = [];
      
      options.forEach((option, index) => {
        const optionText = this.add.text(width / 2, height / 2 + index * 50, option.text, {
          ...zhBase,
          fontSize: '20px',
          color: '#aaf'
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
        
        optionText.on('pointerover', () => {
          optionText.setColor('#fff').setScale(1.1);
        });
        
        optionText.on('pointerout', () => {
          optionText.setColor('#aaf').setScale(1);
        });
        
        optionText.on('pointerup', () => {
          // 清理所有選項
          promptText.destroy();
          optionTexts.forEach(t => t.destroy());
          resolve(option.value);
        });
        
        optionTexts.push(optionText);
      });
    });
  }

  private async typewriterEffect(textObject: Phaser.GameObjects.Text, fullText: string, speed = 40): Promise<void> {
    return new Promise((resolve) => {
      let index = 0;
      
      const timer = this.time.addEvent({
        delay: speed,
        loop: true,
        callback: () => {
          textObject.setText(fullText.slice(0, ++index));
          if (index >= fullText.length) {
            timer.remove();
            resolve();
          }
        }
      });
    });
  }

  private async fadeIn(object: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[], duration: number): Promise<void> {
    return new Promise((resolve) => {
      const targets = Array.isArray(object) ? object : [object];
      targets.forEach(target => {
        this.tweens.add({
          targets: target,
          alpha: 1,
          duration: duration,
          onComplete: () => resolve()
        });
      });
    });
  }

  private async fadeOut(objects: Phaser.GameObjects.GameObject[], duration: number): Promise<void> {
    return new Promise((resolve) => {
      objects.forEach((obj, index) => {
        this.tweens.add({
          targets: obj,
          alpha: 0,
          duration: duration,
          onComplete: () => {
            obj.destroy();
            if (index === objects.length - 1) {
              resolve();
            }
          }
        });
      });
    });
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.time.delayedCall(ms, resolve);
    });
  }

  private async waitForClick(): Promise<void> {
    return new Promise(resolve => {
      const clickHandler = () => {
        this.input.off('pointerup', clickHandler);
        resolve();
      };
      this.input.once('pointerup', clickHandler);
      
      // 顯示點擊提示
      const { width, height } = this.scale;
      const clickHint = this.add.text(width - 20, height - 40, '點擊繼續...', {
        ...zhBase,
        fontSize: '16px',
        color: '#888'
      }).setOrigin(1, 1);
      
      this.time.delayedCall(100, () => {
        clickHint.destroy();
      });
    });
  }


  private fitImageToHeight<T extends Phaser.GameObjects.Image>(image: T, heightRatio: number): T {
    const targetHeight = this.scale.height * heightRatio;
    if (!image.height || targetHeight <= 0) {
      return image;
    }

    const scale = targetHeight / image.height;
    image.setScale(scale);
    return image;
  }

  private skipIntro() {
    this.sound.stopAll();
    this.completeIntro();
  }

  private completeIntro() {
    // 標記開頭已完成
    if (this.world) {
      this.world.setFlag('intro_completed', true);
      
      // 設定初始狀態
      this.world.data.位置 = '港邊醫館後巷';
      this.world.data.煞氣 = '濁';
      
      // 給予初始道具（奶奶的香包）
      this.world.grantItem('it_grandma_amulet');
      
      // 給予初始字卡
      this.world.data.字卡 = ['w_wait', 'w_listen', 'w_help'];
    }
    
    // 進入主選單
    this.scene.start('TitleScene');
  }
}
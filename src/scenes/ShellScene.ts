import { ModuleScene } from '@core/Router';
export default class ShellScene extends ModuleScene {
  constructor(){ super('ShellScene'); }
  create(){
    const world = this.registry.get('world');
    this.add.text(16,16, ()=>`位置：${world.data.位置}  煞氣：${world.data.煞氣}  陰德：${world.data.陰德}`, {color:'#fff'}).setDepth(10);
    const toMap = this.add.text(16, 50, '前往地圖', {color:'#aaf'}).setInteractive();
    toMap.on('pointerup', async ()=>{
      await this.registry.get('router').push('MapScene', {});
    });
  }
}

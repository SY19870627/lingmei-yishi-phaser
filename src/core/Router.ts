import Phaser from 'phaser';
export type RouteCtx<TIn=any,TOut=any> = { in?: TIn; resolve: (r:TOut)=>void; reject:(e:any)=>void; };

type StackEntry = {
  key: string;
  pausedKey?: string;
};

export class Router {
  private stack: StackEntry[] = [];
  private game: Phaser.Game;
  constructor(game: Phaser.Game) {
    this.game = game;
  }
  push<TIn=any,TOut=any>(key: string, input?: TIn): Promise<TOut> {
    return new Promise<TOut>((resolve, reject) => {
      const activeScenes = this.game.scene.getScenes(true);
      const topScene = activeScenes[activeScenes.length - 1] as Phaser.Scene | undefined;
      let pausedKey: string | undefined;
      if (topScene && topScene.scene.isActive()) {
        pausedKey = topScene.scene.key;
        topScene.scene.pause();
      }

      const entry: StackEntry = { key, pausedKey };
      this.stack.push(entry);
      this.game.scene.run(key, { __route__: { in: input, resolve, reject } as RouteCtx<TIn,TOut> });

      const newScene = this.game.scene.getScene(key) as Phaser.Scene | undefined;
      newScene?.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        const index = this.stack.lastIndexOf(entry);
        if (index !== -1) {
          this.stack.splice(index, 1);
        }

        if (entry.pausedKey) {
          const pausedScene = this.game.scene.getScene(entry.pausedKey) as Phaser.Scene | undefined;
          if (pausedScene && pausedScene.scene.isPaused()) {
            pausedScene.scene.resume();
          }
        }
      });
    });
  }
  pop() {
    const entry = this.stack[this.stack.length - 1];
    if (entry) this.game.scene.stop(entry.key);
  }
}
export abstract class ModuleScene<TIn=any,TOut=any> extends Phaser.Scene {
  protected route?: RouteCtx<TIn,TOut>;
  init(data:any){ this.route = data?.__route__; }
  protected done(result:TOut){ this.route?.resolve(result); this.scene.stop(); }
  protected cancel(e:any){ this.route?.reject(e); this.scene.stop(); }
}

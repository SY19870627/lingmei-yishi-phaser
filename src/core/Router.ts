import Phaser from 'phaser';
export type RouteCtx<TIn=any,TOut=any> = { in?: TIn; resolve: (r:TOut)=>void; reject:(e:any)=>void; };

export class Router {
  private stack: string[] = [];
  private game: Phaser.Game;
  constructor(game: Phaser.Game) {
    this.game = game;
  }
  push<TIn=any,TOut=any>(key: string, input?: TIn): Promise<TOut> {
    return new Promise<TOut>((resolve, reject) => {
      this.stack.push(key);
      this.game.scene.run(key, { __route__: { in: input, resolve, reject } as RouteCtx<TIn,TOut> });
    });
  }
  pop() {
    const key = this.stack.pop();
    if (key) this.game.scene.stop(key);
  }
}
export abstract class ModuleScene<TIn=any,TOut=any> extends Phaser.Scene {
  protected route?: RouteCtx<TIn,TOut>;
  init(data:any){ this.route = data?.__route__; }
  protected done(result:TOut){ this.route?.resolve(result); this.scene.stop(); }
  protected cancel(e:any){ this.route?.reject(e); this.scene.stop(); }
}

export class DataRepo {
  private cache = new Map<string, any>();
  private loader:(path:string)=>Promise<any>;
  constructor(loader:(path:string)=>Promise<any>){
    this.loader = loader;
  }
  async get<T=any>(name:string): Promise<T> {
    if (this.cache.has(name)) return this.cache.get(name);
    const data = await this.loader(`/assets/data/${name}.json`);
    this.cache.set(name, data);
    return data as T;
  }
}

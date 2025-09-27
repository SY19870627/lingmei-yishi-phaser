export class DataRepo {
  private cache = new Map<string, any>();
  constructor(private loader:(path:string)=>Promise<any>){
  }
  async get<T=any>(name:string): Promise<T> {
    if (this.cache.has(name)) return this.cache.get(name);
    const data = await this.loader(`/assets/data/${name}.json`);
    this.cache.set(name, data);
    return data as T;
  }
}

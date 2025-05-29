import { 
  DIContainer, 
  ServiceDefinition, 
  ServiceInstance, 
  ServiceRegistry,
  ServiceConstructor 
} from './types';

export class Container implements DIContainer {
  private services: ServiceRegistry = {};
  private instances: Map<string, any> = new Map();

  register<T>(name: string, definition: ServiceDefinition<T>): void {
    this.services[name] = definition;
  }

  registerInstance<T>(name: string, instance: T): void {
    this.instances.set(name, instance);
    this.services[name] = { instance };
  }

  resolve<T>(name: string): T {
    // インスタンスが既に存在する場合は返す
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }

    const serviceDefinition = this.services[name];
    if (!serviceDefinition) {
      throw new Error(`Service '${name}' is not registered.`);
    }

    // インスタンスが直接登録されている場合
    if ('instance' in serviceDefinition) {
      return serviceDefinition.instance;
    }

    // コンストラクタが登録されている場合
    const { constructor: ServiceConstructor, dependencies = [], singleton = true } = serviceDefinition;
    
    // 依存関係を解決
    const resolvedDependencies = dependencies.map(dep => this.resolve(dep));
    
    // インスタンスを作成
    const instance = new ServiceConstructor(...resolvedDependencies);
    
    // シングルトンの場合はキャッシュ
    if (singleton) {
      this.instances.set(name, instance);
    }

    return instance;
  }

  isRegistered(name: string): boolean {
    return name in this.services;
  }

  clear(): void {
    this.services = {};
    this.instances.clear();
  }
}

// グローバルコンテナインスタンス
export const container = new Container(); 
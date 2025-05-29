export interface ServiceConstructor<T = any> {
  new (...args: any[]): T;
}

export interface ServiceInstance<T = any> {
  instance: T;
  dependencies?: string[];
}

export interface ServiceDefinition<T = any> {
  constructor: ServiceConstructor<T>;
  dependencies?: string[];
  singleton?: boolean;
}

export interface DIContainer {
  register<T>(name: string, definition: ServiceDefinition<T>): void;
  registerInstance<T>(name: string, instance: T): void;
  resolve<T>(name: string): T;
  isRegistered(name: string): boolean;
}

export interface ServiceRegistry {
  [key: string]: ServiceDefinition | ServiceInstance;
} 
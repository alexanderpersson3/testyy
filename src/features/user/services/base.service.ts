/**
 * Type for service constructor
 */
export type ServiceConstructor<T extends BaseService> = {
  new (): T;
  getInstance(): T;
  initialize(config: unknown): Promise<void>;
};

/**
 * Base class for implementing the singleton pattern in services
 */
export abstract class BaseService {
  private static _instanceMap = new WeakMap<Function, BaseService>();

  protected constructor() {
    const constructor = this.constructor;
    if (BaseService._instanceMap.has(constructor)) {
      throw new Error(`${constructor.name} is a singleton. Use getInstance() instead.`);
    }
  }

  /**
   * Gets the singleton instance of the service
   */
  protected static _getInstance<S extends BaseService>(
    this: { new(): S }
  ): S {
    const ServiceClass = this;
    if (!BaseService._instanceMap.has(ServiceClass)) {
      BaseService._instanceMap.set(ServiceClass, new ServiceClass());
    }
    return BaseService._instanceMap.get(ServiceClass) as S;
  }

  /**
   * Initializes the service with configuration
   * @param config Service-specific configuration
   */
  protected async initialize(config: unknown): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.doInitialize(config);
    this.initialized = true;
  }

  /**
   * Service-specific initialization logic
   * @param config Service-specific configuration
   */
  protected abstract doInitialize(config: unknown): Promise<void>;

  /**
   * Ensures the service is initialized before use
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      throw new ServiceNotInitializedError(this.constructor.name);
    }
  }

  /**
   * Resets all service instances (mainly for testing)
   */
  protected static resetAllServices(): void {
    BaseService._instanceMap = new WeakMap<Function, BaseService>();
  }

  /**
   * Resets a specific service instance (mainly for testing)
   */
  protected static resetService(ServiceClass: Function): void {
    BaseService._instanceMap.delete(ServiceClass);
  }

  /**
   * Flag indicating if the service is initialized
   */
  protected initialized: boolean = false;
}

/**
 * Type for service initialization options
 */
export interface ServiceConfig {
  [key: string]: unknown;
}

/**
 * Error thrown when service initialization fails
 */
export class ServiceInitializationError extends Error {
  constructor(
    service: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(`Failed to initialize ${service}: ${message}`);
    this.name = 'ServiceInitializationError';
  }
}

/**
 * Error thrown when service is used before initialization
 */
export class ServiceNotInitializedError extends Error {
  constructor(service: string) {
    super(`${service} is not initialized. Call initialize() first.`);
    this.name = 'ServiceNotInitializedError';
  }
}

/**
 * Type guard to check if a value is a ServiceConfig
 */
export function isServiceConfig(value: unknown): value is ServiceConfig {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard to check if a value is a service constructor
 */
export function isServiceConstructor<T extends BaseService>(
  value: unknown
): value is ServiceConstructor<T> {
  return (
    typeof value === 'function' &&
    'getInstance' in value &&
    'initialize' in value &&
    value.prototype instanceof BaseService
  );
} 
/// <reference types="jest" />
import { Response } from 'supertest';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeValidObjectId(): R;
    }
  }
}

declare module 'supertest' {
  interface Response {
    body: any;
  }
}

export {};
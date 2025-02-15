/// <reference types="jest" />
import type { Response } from '../types/express.js';
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeValidObjectId(): R;
    }
  }
}

declare module 'supertest' {
  export interface Test {
    expect(status: number): Test;
    expect(checker: (res: Response) => any): Test;
    end(): Promise<Response>;
  }

  export interface Response {
    status: number;
    body: any;
    headers: { [key: string]: string };
    type: string;
    text: string;
  }
}

export {};

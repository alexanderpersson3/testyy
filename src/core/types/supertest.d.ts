import type { Response } from '../types/express.js';
import { Test } from 'supertest';;

declare module 'supertest' {
  export interface Response {
    body: any;
    headers: { [key: string]: string };
    status: number;
    statusCode: number;
    text: string;
    type: string;
  }

  export interface Test {
    get(url: string): Test;
    post(url: string): Test;
    put(url: string): Test;
    delete(url: string): Test;
    send(data: any): Test;
    set(field: string, val: string): Test;
    set(field: object): Test;
    expect(status: number): Test;
    expect(field: string, val: string | RegExp): Test;
    expect(checker: (res: Response) => void): Test;
    end(fn?: (err: Error | null, res: Response) => void): Promise<Response>;
    then(resolve: (res: Response) => void, reject?: (err: Error) => void): Promise<Response>;
  }

  interface TestAgent<T> extends Test {
    app?: any;
    get(url: string): T;
    post(url: string): T;
    put(url: string): T;
    delete(url: string): T;
  }

  interface Agent extends TestAgent<Test> {
    (app: any): TestAgent<Test>;
  }

  const supertest: Agent;
  export default supertest;
}

// Extend Jest matchers for supertest
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveHTTPStatus: (status: number) => R;
      toBeJSON: () => R;
    }
  }
}

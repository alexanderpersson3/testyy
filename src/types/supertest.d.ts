declare module 'supertest' {
  import { Response } from 'express';

  interface SuperTestResponse extends Response {
    body: any;
    headers: { [key: string]: string };
    status: number;
    type: string;
    text: string;
  }

  interface Test {
    get(url: string): Test;
    post(url: string): Test;
    put(url: string): Test;
    patch(url: string): Test;
    delete(url: string): Test;
    set(field: string, val: string): Test;
    set(field: object): Test;
    send(data: any): Test;
    expect(status: number): Test;
    expect(checker: (res: SuperTestResponse) => any): Test;
    end(fn?: (err: Error | null, res: SuperTestResponse) => void): Promise<SuperTestResponse>;
    attach(field: string, file: string | Buffer, filename?: string): Test;
    query(val: object | string): Test;
  }

  interface Agent extends Test {
    (app: any): Test;
  }

  const supertest: Agent;
  export = supertest;
} 
import { Response } from 'express';

export type TestResponse = {
  body: any;
  statusCode: number;
  status: (code: number) => TestResponse;
  json: (body: any) => TestResponse;
  send: (body: any) => TestResponse;
  // Add other commonly used Response properties
  setHeader: (name: string, value: string) => TestResponse;
  getHeader: (name: string) => string | undefined;
  cookie: (name: string, val: any, options?: any) => TestResponse;
};

export const createTestResponse = (): TestResponse => {
  const res: TestResponse = {
    body: {},
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
    send(body: any) {
      this.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      return this;
    },
    getHeader(name: string) {
      return undefined;
    },
    cookie(name: string, val: any, options?: any) {
      return this;
    }
  };
  
  return res;
}; 

export type TestResponse = {
    body: any;
    statusCode: number;
    status: (code: number) => TestResponse;
    json: (body: any) => TestResponse;
    send: (body: any) => TestResponse;
    setHeader: (name: string, value: string) => TestResponse;
    getHeader: (name: string) => string | undefined;
    cookie: (name: string, val: any, options?: any) => TestResponse;
};
export declare const createTestResponse: () => TestResponse;
//# sourceMappingURL=testTypes.d.ts.map
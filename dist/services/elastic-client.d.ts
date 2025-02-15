import { Client } from '@elastic/elasticsearch';
declare const enhancedClient: Client & {
    ping: () => Promise<boolean>;
};
export { enhancedClient as elasticClient };

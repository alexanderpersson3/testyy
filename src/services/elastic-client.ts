import { Client } from '@elastic/elasticsearch';
import { config } from '../config';

export const elasticClient = new Client({
  node: config.elasticsearch.NODE,
  auth: config.elasticsearch.USERNAME && config.elasticsearch.PASSWORD
    ? {
        username: config.elasticsearch.USERNAME,
        password: config.elasticsearch.PASSWORD,
      }
    : undefined,
}); 
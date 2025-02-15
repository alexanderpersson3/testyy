declare module '../utils/api' {
  import { AxiosInstance } from 'axios';
  export const api: AxiosInstance;
  export const apiUrl: string;
  export const fetchData: (endpoint: string) => Promise<any>;
}
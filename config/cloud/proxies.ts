import { getSecret } from '../config/cloud';

interface ProxyAuth {
  username?: string;
  password?: string;
}

interface ResidentialProxy {
  host: string;
  port: number;
  auth: ProxyAuth;
}

interface BrightDataProxy {
  residential: ResidentialProxy;
}

interface Proxies {
  brightdata: BrightDataProxy;
}

const proxies: Proxies = {
  brightdata: {
    residential: {
      host: process.env.BRIGHTDATA_RESIDENTIAL_HOST || 'brd.superproxy.io',
      port: Number(process.env.BRIGHTDATA_RESIDENTIAL_PORT) || 22225,
      auth: {
        username: process.env.BRIGHTDATA_RESIDENTIAL_USER,
        password: process.env.BRIGHTDATA_RESIDENTIAL_PASSWORD,
      },
    },
  },
};

export default async (): Promise<Proxies> => {
  if (process.env.NODE_ENV === 'production') {
    const secrets:any = await getSecret('brightdata-creds');
    proxies.brightdata.residential.auth.username = secrets.username;
    proxies.brightdata.residential.auth.password = secrets.password;
  }
  return proxies;
};
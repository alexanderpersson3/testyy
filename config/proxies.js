const { getSecret } = require('../utils/aws-secrets');

const proxies = {
  brightdata: {
    residential: {
      host: process.env.BRIGHTDATA_RESIDENTIAL_HOST || 'brd.superproxy.io',
      port: process.env.BRIGHTDATA_RESIDENTIAL_PORT || 22225,
      auth: {
        username: process.env.BRIGHTDATA_RESIDENTIAL_USER,
        password: process.env.BRIGHTDATA_RESIDENTIAL_PASSWORD
      }
    }
  }
};

module.exports = async () => {
  if (process.env.NODE_ENV === 'production') {
    const secrets = await getSecret('brightdata-creds');
    proxies.brightdata.residential.auth.username = secrets.username;
    proxies.brightdata.residential.auth.password = secrets.password;
  }
  return proxies;
};

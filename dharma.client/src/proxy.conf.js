const { env } = require('process');

const target = env.ASPNETCORE_HTTPS_PORT ? `https://localhost:${env.ASPNETCORE_HTTPS_PORT}` :
  env.ASPNETCORE_URLS ? env.ASPNETCORE_URLS.split(';')[0] : 'https://localhost:7191';

const PROXY_CONFIG = [
  {
    context: [
      "/weatherforecast",
      "/api"
    ],
    target,
    secure: false,
    changeOrigin: true,
    onError: (err, req, res) => {
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
        if (res.writeHead && !res.headersSent) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'Esperando backend...' }));
        }
      }
    }
  }
];

module.exports = PROXY_CONFIG;

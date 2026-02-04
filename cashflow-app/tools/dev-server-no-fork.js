/* eslint-disable no-console */
const { startServer } = require("next/dist/server/lib/start-server");

async function main() {
  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  const port = Number(process.env.PORT || 3000);
  const hostname = process.env.HOSTNAME || "0.0.0.0";

  await startServer({
    dir: process.cwd(),
    port,
    hostname,
    minimalMode: false,
    isDev: true,
    allowRetry: true,
    keepAliveTimeout: undefined,
    selfSignedCertificate: undefined,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

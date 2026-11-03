import { buildApp } from './app.ts';
import { config } from './config.ts';
import { scanLibrary } from './scanner.ts';

const app = await buildApp({ logger: true });

await app.listen({ host: config.host, port: config.port });
app.log.info(`Music folder: ${config.musicDir}`);
app.log.info(`Data folder:  ${config.dataDir}`);

async function scan() {
  const result = await scanLibrary();
  app.log.info(
    `Scan finished: ${result.seen} files, +${result.added} ~${result.updated} -${result.removed}, ${result.errors} errors`,
  );
  if (result.lastError) app.log.warn(result.lastError);
}

void scan();
if (config.scanIntervalMinutes > 0) {
  setInterval(() => void scan(), config.scanIntervalMinutes * 60_000).unref();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

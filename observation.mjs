import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { signalPublisher, signalStore } from '@langboard/app-server';
import { githubApi } from './provider-api.mjs';
import { observeCheck } from './signals.mjs';

/** Operator-owned mapping, one explicit provider read, durable recovery only. */
export async function runObservation({ path, config, credentials, resend = false }, request = fetch) {
  const host = { origin: config.hostOrigin, token: credentials.hostToken };
  const publish = signalPublisher(host, request);
  const store = signalStore(path, { origin: config.hostOrigin, providerOrigin: config.providerOrigin, ...config.scope });
  if (resend) {
    const receipts = [];
    for (const envelope of await store.load()) receipts.push(await publish(envelope));
    return receipts;
  }
  const api = githubApi({ origin: config.providerOrigin, token: credentials.providerToken, apiVersion: config.apiVersion }, request);
  return [await observeCheck({ api, scope: config.scope, host, saveEnvelope: envelope => store.save([envelope]) }, request)];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode, configPath, outputPath, extra] = process.argv.slice(2);
  if (!['observe', 'resend'].includes(mode) || !configPath || !outputPath || extra) {
    console.error('Usage: observation.mjs observe|resend CONFIG FILE'); process.exitCode = 2;
  } else {
    try {
      const file = await readFile(configPath);
      if (file.length > 16384) throw new Error('Configuration exceeds limit');
      const receipts = await runObservation({ path: outputPath, config: JSON.parse(file), resend: mode === 'resend',
        credentials: { hostToken: process.env.LANGBOARD_APP_TOKEN, providerToken: process.env.GITHUB_READ_TOKEN } });
      process.stdout.write(JSON.stringify(receipts.map(({ signal_uid, duplicate }) => ({ signal_uid, duplicate }))) + '\n');
    } catch { console.error('Observation failed; inspect the saved batch and native receipts before explicit resend.'); process.exitCode = 1; }
  }
}

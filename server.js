import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { GoogleAuth } from 'google-auth-library';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SECRET_NAMES = [
  'VITE_GEMINI_API_KEY',
  'VITE_DEEPSEEK_API_KEY',
  'VITE_QWEN_API_KEY',
  'VITE_DOUBAO_API_KEY',
  'VITE_Kimi_API_KEY',
];

// Fetches each secret from Google Cloud Secret Manager and writes it into
// process.env, skipping any key that is already set (e.g. via Cloud Run env
// var binding or a local .env.local file).  Requires the service account to
// have the "Secret Manager Secret Accessor" role.
async function loadSecretsFromGSM() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'st-china-ai-force';

  // Verify Application Default Credentials are available before touching the
  // gRPC client — avoids an unhandled async crash when running locally without
  // gcloud credentials.
  try {
    await new GoogleAuth().getApplicationDefault();
  } catch {
    console.log('No GCP credentials found — skipping Secret Manager, using process.env directly.');
    return;
  }

  console.log(`Fetching secrets from project: ${projectId}`);
  const client = new SecretManagerServiceClient();
  await Promise.all(
    SECRET_NAMES.map(async (name) => {
      if (process.env[name]) return; // already provided via env var binding
      try {
        const [version] = await client.accessSecretVersion({
          name: `projects/${projectId}/secrets/${name}/versions/latest`,
        });
        const value = version.payload?.data?.toString('utf8');
        if (value) {
          process.env[name] = value;
          console.log(`Loaded secret: ${name}`);
        }
      } catch (err) {
        console.warn(`Could not load secret ${name}: ${err.message}`);
      }
    })
  );
}

async function startServer() {
  await loadSecretsFromGSM();

  const app = express();
  const port = process.env.PORT || 8080;

  // Dynamic endpoint for runtime environment variables.
  // All VITE_ keys are populated here (from Secret Manager or env var binding)
  // so the frontend picks them up via window.env without a rebuild.
  app.get('/config.js', (req, res) => {
    const envVars = {
      VITE_GEMINI_API_KEY:   process.env.VITE_GEMINI_API_KEY   || '',
      VITE_DEEPSEEK_API_KEY: process.env.VITE_DEEPSEEK_API_KEY || '',
      VITE_QWEN_API_KEY:     process.env.VITE_QWEN_API_KEY     || '',
      VITE_DOUBAO_API_KEY:   process.env.VITE_DOUBAO_API_KEY   || '',
      VITE_Kimi_API_KEY:     process.env.VITE_Kimi_API_KEY     || '',
    };
    res.set('Content-Type', 'application/javascript');
    res.send(`window.env = ${JSON.stringify(envVars)};`);
  });

  // Serve static files from the build directory
  app.use(express.static(path.join(__dirname, 'dist')));

  // Support SPA routing (redirect all non-file requests to index.html)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

startServer();

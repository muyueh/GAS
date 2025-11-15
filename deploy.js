#!/usr/bin/env node

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const {google} = require('googleapis');

const SCOPES = [
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments',
  'https://www.googleapis.com/auth/script.scriptapp',
];

async function main() {
  const {
    APPS_SCRIPT_ID,
    GCP_SERVICE_ACCOUNT_KEY,
    APPS_SCRIPT_DEPLOYMENT_ID,
    APPS_SCRIPT_RUN_FUNCTION,
    APPS_SCRIPT_RUN_PARAMETERS,
  } = process.env;

  if (!APPS_SCRIPT_ID) {
    throw new Error('APPS_SCRIPT_ID environment variable is required.');
  }

  if (!GCP_SERVICE_ACCOUNT_KEY) {
    throw new Error('GCP_SERVICE_ACCOUNT_KEY environment variable is required.');
  }

  const credentials = parseServiceAccountKey(GCP_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });
  const client = await auth.getClient();
  const script = google.script({version: 'v1', auth: client});

  const files = await collectScriptFiles(path.resolve(__dirname, 'src'));
  console.log(`Preparing to upload ${files.length} file(s) to Apps Script project ${APPS_SCRIPT_ID}.`);

  await safeApiCall(
    () =>
      script.projects.updateContent({
        scriptId: APPS_SCRIPT_ID,
        requestBody: {files},
      }),
    'Failed to update Apps Script project content.'
  );
  console.log('Apps Script project content updated.');

  let versionNumber;
  try {
    const versionResponse = await safeApiCall(
      () =>
        script.projects.versions.create({
          scriptId: APPS_SCRIPT_ID,
          requestBody: {description: `Automated deployment ${new Date().toISOString()}`},
        }),
      'Failed to create a new project version.'
    );
    versionNumber = versionResponse.data.version?.versionNumber;
    if (versionNumber) {
      console.log(`Created version ${versionNumber}.`);
    } else {
      console.warn('Created version but did not receive a version number.');
    }
  } catch (error) {
    throw error;
  }

  if (APPS_SCRIPT_DEPLOYMENT_ID && versionNumber) {
    try {
      await safeApiCall(
        () =>
          script.projects.deployments.update({
            scriptId: APPS_SCRIPT_ID,
            deploymentId: APPS_SCRIPT_DEPLOYMENT_ID,
            requestBody: {
              deploymentConfig: {
                versionNumber,
                manifestFileName: 'appsscript',
                description: `Automated deployment ${new Date().toISOString()}`,
              },
            },
          }),
        `Failed to update deployment ${APPS_SCRIPT_DEPLOYMENT_ID}.`
      );
      console.log(`Deployment ${APPS_SCRIPT_DEPLOYMENT_ID} updated to version ${versionNumber}.`);
    } catch (error) {
      throw error;
    }
  }

  if (APPS_SCRIPT_RUN_FUNCTION) {
    const parameters = parseOptionalJson(APPS_SCRIPT_RUN_PARAMETERS);
    try {
      const runResponse = await safeApiCall(
        () =>
          script.scripts.run({
            scriptId: APPS_SCRIPT_ID,
            requestBody: {
              function: APPS_SCRIPT_RUN_FUNCTION,
              parameters,
            },
          }),
        `Failed to execute post-deployment function ${APPS_SCRIPT_RUN_FUNCTION}.`
      );
      if (runResponse.data.error) {
        console.error('Post-deployment function execution error:', runResponse.data.error);
        throw new Error('scripts.run returned an error.');
      }
      console.log('Post-deployment function executed successfully.');
      if (runResponse.data.response) {
        console.log('Function response:', JSON.stringify(runResponse.data.response, null, 2));
      }
    } catch (error) {
      throw error;
    }
  }
}

async function safeApiCall(requestFn, contextMessage) {
  try {
    return await requestFn();
  } catch (error) {
    throw wrapGoogleError(error, contextMessage);
  }
}

function parseServiceAccountKey(value) {
  const attempts = [value];
  try {
    attempts.push(Buffer.from(value, 'base64').toString('utf8'));
  } catch (error) {
    // Ignore base64 decoding errors.
  }

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed.private_key || !parsed.client_email) {
        throw new Error('Missing expected service account fields.');
      }
      return parsed;
    } catch (error) {
      // Try next candidate.
    }
  }
  throw new Error('Unable to parse GCP service account key from environment variable.');
}

async function collectScriptFiles(sourceDir) {
  let stats;
  try {
    stats = await fs.stat(sourceDir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Source directory not found: ${sourceDir}`);
    }
    throw error;
  }

  if (!stats.isDirectory()) {
    throw new Error(`Source path is not a directory: ${sourceDir}`);
  }

  const entries = await walkDirectory(sourceDir);
  const files = entries
    .map((entry) => toScriptFile(sourceDir, entry))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!files.some((file) => file.type === 'JSON' && file.name === 'appsscript')) {
    console.warn('Warning: appsscript.json is missing from the payload.');
  }

  if (files.length === 0) {
    console.warn('No script files were discovered. The Apps Script project will be cleared.');
  }

  return files;
}

async function walkDirectory(dir) {
  const entries = await fs.readdir(dir, {withFileTypes: true});
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkDirectory(fullPath);
      results.push(...nested);
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

function toScriptFile(rootDir, absolutePath) {
  const relativePath = path.relative(rootDir, absolutePath);
  const ext = path.extname(relativePath).toLowerCase();
  const normalizedName = relativePath.slice(0, -ext.length).split(path.sep).join('/');

  switch (ext) {
    case '.gs':
    case '.js':
      return {
        name: normalizedName || path.basename(relativePath, ext),
        type: 'SERVER_JS',
        source: readFileSyncSafe(absolutePath),
      };
    case '.html':
      return {
        name: normalizedName || path.basename(relativePath, ext),
        type: 'HTML',
        source: readFileSyncSafe(absolutePath),
      };
    case '.json':
      if (relativePath === 'appsscript.json') {
        return {
          name: 'appsscript',
          type: 'JSON',
          source: readFileSyncSafe(absolutePath),
        };
      }
      return null;
    default:
      return null;
  }
}

function readFileSyncSafe(filename) {
  return fsSync.readFileSync(filename, 'utf8');
}

function parseOptionalJson(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [parsed];
  } catch (error) {
    return [value];
  }
}

main().catch((error) => {
  if (error?.cause) {
    console.error(error.message);
    const diagnostic = formatGoogleDiagnostic(error.cause);
    if (diagnostic) {
      console.error(diagnostic);
    }
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

function wrapGoogleError(error, contextMessage) {
  const details = extractGoogleErrorDetails(error);
  const guidance = suggestGoogleErrorResolution(error);
  const messageParts = [contextMessage, details, guidance].filter(Boolean);
  const message = messageParts.join(' ');
  return new Error(message || contextMessage, {cause: error});
}

function extractGoogleErrorDetails(error) {
  const responseError = error?.response?.data?.error;
  if (responseError?.message) {
    const status = responseError.status || error.code || error.status;
    if (status) {
      return `Google API error (${status}): ${responseError.message}`;
    }
    return `Google API error: ${responseError.message}`;
  }
  if (error?.message) {
    return error.message;
  }
  return null;
}

function suggestGoogleErrorResolution(error) {
  const responseError = error?.response?.data?.error;
  const message = responseError?.message || error?.message || '';
  if (
    responseError?.status === 'PERMISSION_DENIED' &&
    message.toLowerCase().includes('apps script api')
  ) {
    return 'Ensure the Apps Script API is enabled for the project by visiting https://script.google.com/home/usersettings.';
  }
  return null;
}

function formatGoogleDiagnostic(error) {
  const responseError = error?.response?.data?.error;
  if (!responseError) {
    return error?.message ? `Cause: ${error.message}` : null;
  }

  const lines = [];
  if (responseError.status) {
    lines.push(`Status: ${responseError.status}`);
  }
  if (typeof error.code !== 'undefined') {
    lines.push(`Code: ${error.code}`);
  }
  if (responseError.message) {
    lines.push(`Message: ${responseError.message}`);
  }
  if (Array.isArray(responseError.details) && responseError.details.length > 0) {
    const detailMessages = responseError.details
      .map((detail) => detail?.errorType || detail?.detail || JSON.stringify(detail))
      .filter(Boolean);
    if (detailMessages.length > 0) {
      lines.push(`Details: ${detailMessages.join('; ')}`);
    }
  }
  return lines.join('\n');
}

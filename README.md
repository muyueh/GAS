# GAS

```mermaid
gitGraph
    commit id: "Initial commit"
    branch work
    checkout work
    commit id: "Deployment tooling"
```

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Preparing: npm run deploy
    Preparing --> Uploading: Collect source files
    Uploading --> Versioning: projects.updateContent
    Versioning --> Deploying: versions.create
    Deploying --> Idle: deployments.update
    Deploying --> PostDeploy: scripts.run (optional)
    PostDeploy --> Idle
```

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant CLI as deploy.js
    participant GAS as Apps Script API
    Dev->>CLI: npm run deploy
    CLI->>GAS: Authenticate with service account
    CLI->>GAS: projects.updateContent(files)
    CLI->>GAS: versions.create()
    alt Deployment ID provided
        CLI->>GAS: deployments.update(version)
    end
    opt Post-deployment function
        CLI->>GAS: scripts.run(function, params)
        GAS-->>CLI: Execution response
    end
    CLI-->>Dev: Deployment summary
```

```mermaid
graph TD
    Dev[Developer workstation]
    NPM[npm scripts]
    Deploy[deploy.js]
    GASAPI[Google Apps Script API]
    Project[Apps Script Project]

    Dev --> NPM
    NPM --> Deploy
    Deploy --> GASAPI
    GASAPI --> Project
```

```mermaid
flowchart LR
    subgraph Developer
        A[Prepare env vars]
        B[Run npm run deploy]
    end
    subgraph Frontend
        C[Apps Script UI receives updated files]
    end
    subgraph Backend
        D[Google Auth handles JWT]
        E[Projects API updates content]
        F[Deployments API promotes version]
        G[Scripts API runs post-deploy]
    end

    A --> B
    B --> D
    D --> E
    E --> C
    E --> F
    F --> G
```

## Overview

This repository provides a lightweight deployment utility for Google Apps Script projects. The workflow packages the contents of the local `src/` directory and publishes them to an Apps Script project using a service account.

## Prerequisites

- Node.js 18 or later.
- A Google Cloud project with the Apps Script API enabled.
- A service account JSON key with access to the Apps Script project.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `APPS_SCRIPT_ID` | ✅ | Target Apps Script project ID. |
| `GCP_SERVICE_ACCOUNT_KEY` | ✅ | Service account key JSON string or base64-encoded JSON. |
| `APPS_SCRIPT_DEPLOYMENT_ID` | ➖ | Deployment ID to promote after creating a new version. |
| `APPS_SCRIPT_RUN_FUNCTION` | ➖ | Function name to invoke via `scripts.run` after deployment. |
| `APPS_SCRIPT_RUN_PARAMETERS` | ➖ | JSON array (or single value) of parameters for the post-deployment function. |

## Usage

1. Place your Apps Script sources under the `src/` directory (`.gs`, `.js`, `.html`, and `appsscript.json`).
2. Export your service account key JSON and store it in `GCP_SERVICE_ACCOUNT_KEY` (raw JSON or base64 encoded).
3. Run the deployment:

   ```bash
   npm run deploy
   ```

The script will upload the file payload, create a new version, optionally update a deployment, and optionally execute a post-deployment function.

## Deployment Flow

1. **Content Update** – The `files` payload is generated from the `src/` directory and sent via `projects.updateContent`.
2. **Versioning** – A descriptive version is created through `projects.versions.create` to preserve a checkpoint.
3. **Deployment Promotion** – If `APPS_SCRIPT_DEPLOYMENT_ID` is provided, the deployment is updated to the newly created version.
4. **Post-Deployment Automation** – When `APPS_SCRIPT_RUN_FUNCTION` is set, the specified function is invoked by `scripts.run` with optional parameters.

## Development Notes

- The service account key can be provided as either raw JSON or base64-encoded JSON. Invalid payloads are rejected with a descriptive error.
- Missing `appsscript.json` files trigger a warning because Apps Script deployments rely on the manifest.
- Empty `src/` directories are allowed but will result in a warning that the remote project could be cleared.

## License

ISC

# GAS

```mermaid
gitGraph
    commit id: "Initial commit"
    branch main
    checkout main
    branch work
    checkout work
    branch codex/setup-google-apps-script-project-structure
    checkout codex/setup-google-apps-script-project-structure
    commit id: "Add Apps Script deployment automation"
    commit id: "Add initial Apps Script scaffold"
    checkout work
    merge codex/setup-google-apps-script-project-structure id: "Merge PR #1"
    branch codex/initialize-package.json-and-create-deploy-script
    checkout codex/initialize-package.json-and-create-deploy-script
    merge main id: "Sync main into feature"
    checkout work
    merge codex/initialize-package.json-and-create-deploy-script id: "Merge PR #2"
    commit id: "Add Actions deploy workflow"
```

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Triggered: push/workflow_dispatch
    Triggered --> Checkout: actions/checkout@v4
    Checkout --> SetupNode: actions/setup-node@v4 (Node 18)
    SetupNode --> Install: npm ci
    Install --> Deploy: npm run deploy
    Deploy --> Success: Deployment succeeded
    Deploy --> Failure: Deployment failed
    Success --> Idle
    Failure --> Idle
```

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub Actions
    participant Runner as Workflow Runner
    participant NPM as npm CLI
    participant Deploy as deploy.js
    participant GAS as Apps Script API

    Dev->>GH: Push to main/work
    GH->>Runner: Start deploy workflow
    Runner->>Runner: Checkout repository
    Runner->>Runner: Setup Node.js 18
    Runner->>NPM: npm ci
    NPM-->>Runner: Dependencies installed
    Runner->>NPM: npm run deploy
    NPM->>Deploy: Execute deploy.js
    Deploy->>GAS: projects.updateContent
    Deploy->>GAS: versions.create
    alt Deployment ID provided
        Deploy->>GAS: deployments.update
    end
    opt Post-deployment function
        Deploy->>GAS: scripts.run
        GAS-->>Deploy: Execution response
    end
    Deploy-->>Runner: Deployment summary
    Runner-->>GH: Report status
    GH-->>Dev: Notify results
```

```mermaid
graph TD
    Dev[Developer workstation]
    GH[GitHub Actions Workflow]
    Runner[Hosted runner]
    NPM[npm scripts]
    Deploy[deploy.js]
    GASAPI[Google Apps Script API]
    Project[Apps Script Project]

    Dev --> GH
    GH --> Runner
    Runner --> NPM
    NPM --> Deploy
    Deploy --> GASAPI
    GASAPI --> Project
```

```mermaid
flowchart LR
    subgraph Developer
        A[Push to main/work]
    end
    subgraph GitHub_Actions
        B[Trigger deploy workflow]
        C[Checkout repo]
        D[Setup Node 18]
        E[npm ci]
        F[npm run deploy]
    end
    subgraph Frontend
        G[Apps Script UI receives updated files]
    end
    subgraph Backend
        H[Google Auth handles JWT]
        I[Projects API updates content]
        J[Deployments API promotes version]
        K[Scripts API runs post-deploy]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> H
    H --> I
    I --> G
    I --> J
    J --> K
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

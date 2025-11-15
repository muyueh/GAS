# GAS

```mermaid
gitGraph
  commit id: "Initial commit"
  commit id: "Apps Script scaffold"
```

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Authoring : Update code
    Authoring --> DeployReady : Push to Apps Script
    DeployReady --> Executing : Run via scripts.run
    Executing --> Monitoring : Review logs
    Monitoring --> Idle : Iteration complete
```

```mermaid
sequenceDiagram
    participant User
    participant Frontend as HTML UI
    participant AppsScript as Google Apps Script
    User->>Frontend: Load index.html
    Frontend->>AppsScript: google.script.run.helloWorld()
    AppsScript-->>Frontend: Returns greeting message
    Frontend-->>User: Display result / log output
```

```mermaid
graph TD
    A[User] -->|HTTP Request| B[Apps Script Web App]
    B --> C[helloWorld Function]
    C --> D[Logger]
    B --> E[index.html Frontend]
    E --> A
```

```mermaid
flowchart LR
    subgraph User
        U1[Click Run]
    end
    subgraph Frontend
        F1[Call google.script.run]
        F2[Render greeting]
    end
    subgraph Backend
        B1[helloWorld]
        B2[Logger.log]
    end

    U1 --> F1 --> B1 --> B2
    B1 --> F2 --> U1
```

This repository contains a minimal Google Apps Script project scaffold ready for deployment with `deploy.js` or `clasp`. The script exposes a globally accessible `helloWorld()` function that logs and returns a greeting, making it suitable for invocation through `scripts.run` or as a web app entry point.

## Project Structure

- `src/appsscript.json`: Base Apps Script manifest with timezone, runtime, and logging configuration.
- `src/Code.gs`: Server-side script file exposing `helloWorld()`.
- `src/index.html`: Frontend view that can be served by a web app deployment.

## Usage

1. Update or extend the scripts within `src/` as needed.
2. Deploy using your preferred workflow (`clasp`, `deploy.js`, etc.).
3. Invoke `helloWorld()` via `scripts.run` or by loading the web app to confirm the setup.

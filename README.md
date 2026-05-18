# AI SDLC Sprint Board 🚀

[![CI — Pull Request Checks](https://github.com/jzhoupaycor/ai-sdlc-demo/actions/workflows/ci.yml/badge.svg)](https://github.com/jzhoupaycor/ai-sdlc-demo/actions/workflows/ci.yml)
[![Deploy — GitHub Pages](https://github.com/jzhoupaycor/ai-sdlc-demo/actions/workflows/deploy.yml/badge.svg)](https://github.com/jzhoupaycor/ai-sdlc-demo/actions/workflows/deploy.yml)

> **Live Demo:** https://jzhoupaycor.github.io/ai-sdlc-demo/

An interactive Kanban sprint board demonstrating a fully automated **AI-driven SDLC delivery workflow** with a **human-in-the-loop** code review gate.

---

## 🏗️ Architecture: AI SDLC Delivery Pipeline

```
Developer / AI Agent
       │
       ▼
  Feature Branch  ──push──▶  Pull Request
                                  │
                     ┌────────────▼────────────┐
                     │   🤖 GitHub Actions CI  │
                     │  ─────────────────────  │
                     │  ✅ HTML validation      │
                     │  ✅ Secret scanning      │
                     │  ✅ Accessibility check  │
                     │  ✅ PR comment report    │
                     └────────────┬────────────┘
                                  │ all checks pass
                                  ▼
                     ┌────────────────────────┐
                     │  👀 Human Code Review  │  ◀── HUMAN IN THE LOOP
                     │  (required by CODEOWNERS│
                     │   + branch protection) │
                     └────────────┬───────────┘
                                  │ approved + merged to main
                                  ▼
                     ┌────────────────────────┐
                     │  🚀 Auto-Deploy        │
                     │  GitHub Pages          │
                     │  (deploy.yml)          │
                     └────────────────────────┘
                                  │
                                  ▼
                         🌐 Live on the Internet
```

---

## ✨ Features of the Demo App

- **Kanban Board** with 4 columns: Backlog → In Progress → Review → Done
- **Drag & Drop** cards between columns
- **Click to edit** any task
- **Priority labels** (High / Medium / Low) with color coding
- **Assignee tracking** (including `@agent🤖` for AI-created tasks)
- **LocalStorage persistence** — board state survives page refreshes
- **Responsive layout** — works on mobile, tablet, and desktop
- **Toast notifications** for all actions
- **Pipeline status banner** showing current stage

---

## 🔄 Workflow Details

### Branch Protection Rules (on `main`)
| Rule | Setting |
|------|---------|
| Require PR before merge | ✅ Enabled |
| Required approvals | **1** (human reviewer) |
| Dismiss stale reviews on new push | ✅ Enabled |
| Require status checks to pass | ✅ CI must pass |
| Restrict direct pushes to main | ✅ Enabled |

### CI Workflow (`ci.yml`) — Runs on every PR
1. **Lint & Validate** — Checks HTML structure, file presence, no debugger statements, no hardcoded secrets
2. **Accessibility Quick-Check** — Warns on missing `alt` attributes and `lang`
3. **Build Summary** — Posts a formatted report as a PR comment

### Deploy Workflow (`deploy.yml`) — Runs on merge to `main`
1. **Build** — Injects commit SHA + timestamp + actor into the footer
2. **Deploy** — Publishes to GitHub Pages via `actions/deploy-pages`

### CODEOWNERS
All files are owned by `@jzhoupaycor`. Any PR automatically requests their review.

---

## 🚀 Getting Started Locally

```bash
# Clone the repo
git clone https://github.com/jzhoupaycor/ai-sdlc-demo.git
cd ai-sdlc-demo

# Open in browser (no build step needed — it's static!)
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

---

## 🤖 This Project Was Built By AI Agents

This repository was created end-to-end by GitHub Copilot CLI agents as a demonstration of the AI SDLC workflow — from code generation to PR creation to automated deployment.

_"Agents write the code. Humans review it. GitHub Actions ships it."_

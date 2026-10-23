# Contributing to GitWizard 🧙‍♂️

Thank you for your interest in contributing to GitWizard! We are building the ultimate intent-based safety net and Git orchestrator for vibe coders.

---

## 🛠️ Development Setup

1. **Prerequisites**:
   - [Node.js](https://nodejs.org/) (v18 or v20+)
   - [Git](https://git-scm.com/) (v2.30+)
   - [VS Code](https://code.visualstudio.com/) or [Antigravity IDE](https://antigravity.google/)

2. **Clone & Install**:
   ```bash
   git clone https://github.com/DrOpenSource/GitWizard.git
   cd GitWizard
   npm install
   ```

3. **Running the Test Suite**:
   ```bash
   npm test
   # Or watch mode:
   npm run test:watch
   ```

4. **Building & Compiling**:
   ```bash
   npm run compile   # TypeScript check without emitting
   npm run build     # esbuild bundle of extension and webview
   ```

5. **Packaging VSIX**:
   ```bash
   npm run package
   ```

---

## 🛡️ Git Safety Guidelines

When working on core engine or wizard logic, follow these invariant rules:
1. **Never lose user data**: Destructive Git operations (`reset --hard`, `checkout -f`, `rebase`, `stash pop`) must **ALWAYS** be preceded by a snapshot created with `SnapshotManager.createSnapshot()`.
2. **Shadow Index**: Avoid mutating the user's real `.git/index` during non-committing operations. Always use an isolated `GIT_INDEX_FILE` for passive inspections or snapshot tree generation.
3. **Atomic Transactions**: Multi-step operations must use `TransactionRunner` to ensure automatic rollback on failure.

---

## 🧪 Testing Requirements

- Any new wizard or engine feature must include automated unit/integration tests in `test/`.
- Test real Git behavior using isolated temporary directories (`fs.mkdtempSync`).
- All tests must pass cleanly on Windows, macOS, and Linux.

---

## 📝 Pull Request Workflow

1. Fork the repository and create your branch from `main`.
2. Ensure `npm test` and `npm run compile` pass with 0 errors.
3. Open a Pull Request with a clear description of the problem solved.

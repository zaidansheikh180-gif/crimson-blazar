# 🤝 Contributing to SmartTrack AI

Thank you for considering contributing to **SmartTrack AI**! We welcome contributions from the community.

---

## 📋 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the issue, not the person
- Help maintain a positive community

---

## 🐛 Reporting Bugs

Before creating a bug report:

1. **Check existing issues** - Someone may have already reported it
2. **Verify it's reproducible** - Test on a clean install
3. **Gather information** - OS, Node version, browser (if frontend issue)

**Bug Report Template:**

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g., Ubuntu 22.04, Windows 11]
- Node.js version: [e.g., 18.0.0]
- Browser: [e.g., Chrome 120]

**Additional context**
Any other relevant information.
```

---

## 💡 Suggesting Features

We love feature suggestions! Before suggesting:

1. **Check roadmap** - It might already be planned
2. **Search existing suggestions** - Avoid duplicates
3. **Explain the use case** - Help us understand why it's valuable

**Feature Request Template:**

```markdown
**Is your feature request related to a problem?**
A clear description of the problem. Ex. I'm always frustrated when [...]

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features you've considered.

**Additional context**
Mockups, diagrams, or examples.
```

---

## 🔧 Development Setup

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/crimson-blazar.git
   cd crimson-blazar
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/zaidansheikh180-gif/crimson-blazar.git
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

6. **Run in development mode**
   ```bash
   npm run dev
   ```

7. **Seed test data**
   ```bash
   npm run seed
   ```

---

## 🌿 Branching Strategy

- `main` - Stable production code
- `develop` - Integration branch for features
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Urgent production fixes

**Creating a feature branch:**
```bash
git checkout develop
git pull upstream develop
git checkout -b feature/my-awesome-feature
```

---

## 📝 Commit Guidelines

Use **conventional commits** format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, no logic change)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `chore` - Maintenance tasks (dependencies, build config)

**Examples:**
```bash
feat(auth): add face recognition login
fix(dashboard): correct attendance percentage calculation
docs(readme): update deployment instructions
refactor(database): optimize query performance
```

---

## ✅ Pull Request Process

1. **Create a feature branch** (see above)

2. **Make your changes**
   - Write clean, readable code
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed

3. **Test your changes**
   ```bash
   # Run linter (if configured)
   npm run lint
   
   # Run tests (if available)
   npm test
   
   # Manual testing
   npm run dev
   ```

4. **Commit with clear messages**
   ```bash
   git add .
   git commit -m "feat(feature-name): add feature description"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/my-awesome-feature
   ```

6. **Create Pull Request**
   - Go to GitHub and click "New Pull Request"
   - Select your branch
   - Fill in the PR template (see below)

7. **Address review feedback**
   - Respond to comments
   - Make requested changes
   - Push additional commits

8. **Wait for approval**
   - PRs require 1 approval before merging
   - CI checks must pass (if configured)

---

## 📄 Pull Request Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested this:
- [ ] Manual testing completed
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated (if needed)
- [ ] No new warnings introduced
- [ ] Tested on multiple browsers (if frontend)

## Screenshots (if applicable)
Add screenshots for UI changes.

## Related Issues
Closes #123
```

---

## 🎨 Code Style

### JavaScript
- Use **camelCase** for variables and functions
- Use **PascalCase** for classes
- Use **UPPER_SNAKE_CASE** for constants
- Indent with **4 spaces** (or 2, based on existing files)
- Use semicolons
- Prefer `const` over `let`, avoid `var`

### File Naming
- **Lowercase with hyphens** for files: `my-component.js`
- **PascalCase** for React components: `MyComponent.jsx`

### Comments
```javascript
// Good: Explain WHY, not WHAT
// Calculate distance using Euclidean formula because face-api.js uses 128-dimensional vectors
const distance = euclideanDistance(descriptor1, descriptor2);

// Bad: State the obvious
// Calculate distance
const distance = euclideanDistance(descriptor1, descriptor2);
```

---

## 🧪 Testing (Future)

When tests are added:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.js

# Run with coverage
npm test -- --coverage
```

---

## 📚 Documentation

- Update `README.md` for user-facing changes
- Update `DEPLOYMENT.md` for deployment-related changes
- Add inline comments for complex logic
- Update API documentation (if exists)

---

## 🚀 Release Process

1. Merge approved PRs to `develop`
2. Test on staging environment
3. Create release branch: `release/v1.x.x`
4. Update version in `package.json`
5. Update `CHANGELOG.md`
6. Merge to `main`
7. Tag release: `git tag v1.x.x`
8. Push tags: `git push --tags`

---

## ❓ Questions?

- **Discord/Slack:** [Your Community Link]
- **GitHub Discussions:** [Enable if needed]
- **Email:** [Your Contact]

---

## 🙏 Thank You!

Your contributions make **SmartTrack AI** better for everyone. Thank you! ❤️

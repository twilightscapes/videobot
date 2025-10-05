# Contributing to Bluesky Video Privacy Bot

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## 🚀 Getting Started

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/your-username/videobot.git
   cd videobot
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 💻 Development Workflow

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Check code style
npm run lint
npm run format:check

# Auto-fix issues
npm run lint:fix
npm run format
```

### Before Committing

1. **Run linting**: `npm run lint:fix`
2. **Format code**: `npm run format`
3. **Test locally**: `npm run dev`
4. **Build successfully**: `npm run build`

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add support for Instagram videos
fix: resolve duplicate reply issue
docs: update deployment instructions
refactor: simplify URL extraction logic
```

Prefixes:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test updates
- `chore:` Maintenance tasks

## 🎯 What to Contribute

### Ideas for Contributions

- **New platform support** (Instagram, Reddit, etc.)
- **Bug fixes** and error handling improvements
- **Performance optimizations**
- **Documentation improvements**
- **Test coverage**
- **Feature enhancements**

### Adding a New Platform

1. Add URL detection pattern in `src/utils.ts`
2. Update `extractVideoInfo()` method
3. Test with various URL formats
4. Update README with platform details
5. Add test cases

Example:
```typescript
// In extractVideoInfo()
const instagramMatch = text.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+)/);
if (instagramMatch) {
  return {
    url: instagramMatch[0],
    platform: 'instagram',
    id: instagramMatch[1]
  };
}
```

## 🧪 Testing

Currently, we have manual test scripts in `tests/`:

```bash
npm test
```

When adding features:
1. Create test file in `tests/` folder
2. Test edge cases
3. Verify with real Bluesky posts

## 📝 Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new features
3. **Run all checks**: lint, format, build
4. **Create PR** with clear description:
   - What does this PR do?
   - Why is it needed?
   - How to test it?
5. **Wait for review** and address feedback

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement

## Testing
How was this tested?

## Checklist
- [ ] Code follows project style
- [ ] Lint and format checks pass
- [ ] Documentation updated
- [ ] Tests added/updated
```

## 🐛 Reporting Bugs

When reporting bugs, include:

1. **Clear title** describing the issue
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Environment details** (Node version, OS, etc.)
6. **Error messages** or logs

## 💡 Suggesting Features

For feature requests:

1. **Check existing issues** first
2. **Describe the feature** clearly
3. **Explain use case** - why is it needed?
4. **Provide examples** if possible

## 📋 Code Review Guidelines

When reviewing PRs:

- Be respectful and constructive
- Test the changes locally
- Check for edge cases
- Verify documentation is updated
- Ensure tests pass

## 🤝 Community

- Be respectful and welcoming
- Help others learn
- Share knowledge
- Give credit where due

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## ❓ Questions?

Feel free to open an issue for any questions or clarifications needed!

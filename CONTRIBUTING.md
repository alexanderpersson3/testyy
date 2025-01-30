# Contributing to Rezepta

Thank you for your interest in contributing to Rezepta! This document provides guidelines and instructions for contributing to the project.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Documentation](#documentation)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. All contributors are expected to adhere to our Code of Conduct:

- Be respectful and inclusive
- Exercise empathy and kindness
- Provide and accept constructive feedback
- Focus on what is best for the community
- Show courtesy and respect towards other community members

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/rezepta-backend.git`
3. Add the upstream remote: `git remote add upstream https://github.com/original/rezepta-backend.git`
4. Create a new branch for your changes: `git checkout -b feature/your-feature-name`

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update the values as needed

3. Start the development server:
   ```bash
   npm run dev
   ```

## Coding Standards

We follow these coding standards:

### JavaScript
- Use ES6+ features
- Follow the Airbnb JavaScript Style Guide
- Use meaningful variable and function names
- Add JSDoc comments for functions
- Maximum line length: 100 characters
- Use async/await for asynchronous operations

### API Design
- Follow RESTful principles
- Use consistent endpoint naming
- Include proper error handling
- Validate input data
- Return standardized response formats

### File Structure
```
src/
├── routes/         # API routes
├── middleware/     # Express middleware
├── services/       # Business logic
├── models/         # Data models
├── utils/          # Helper functions
└── tests/          # Test files
```

## Making Changes

1. Create a new branch for each feature/fix
2. Write clear, concise commit messages
3. Follow the commit message format:
   ```
   type(scope): description

   [optional body]
   [optional footer]
   ```
   Types: feat, fix, docs, style, refactor, test, chore

4. Keep changes focused and atomic
5. Update tests and documentation

## Testing

1. Write tests for new features
2. Ensure all tests pass before submitting:
   ```bash
   npm test
   ```

3. Maintain or improve code coverage
4. Include both unit and integration tests

## Pull Request Process

1. Update the README.md with details of changes if needed
2. Update the documentation
3. Ensure all tests pass
4. Link any related issues
5. Follow the PR template
6. Request review from maintainers
7. Address review feedback

### PR Template
```markdown
## Description
[Describe your changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How Has This Been Tested?
[Describe your test approach]

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code
- [ ] I have updated the documentation
- [ ] I have added tests
- [ ] All tests pass
```

## Documentation

1. Update API documentation for new/modified endpoints
2. Include JSDoc comments for functions
3. Update README.md if needed
4. Document any new environment variables
5. Add examples for new features

### API Documentation Format
```javascript
/**
 * @api {method} /path Description
 * @apiName OperationName
 * @apiGroup GroupName
 * @apiVersion 1.0.0
 *
 * @apiParam {Type} name Description
 *
 * @apiSuccess {Type} name Description
 *
 * @apiError {Type} name Description
 */
```

## Best Practices

### Security
- Never commit sensitive data
- Validate all user input
- Use proper authentication/authorization
- Follow security best practices

### Performance
- Use indexes appropriately
- Optimize database queries
- Implement caching where needed
- Monitor performance impact

### Error Handling
- Use try-catch blocks
- Return appropriate status codes
- Provide meaningful error messages
- Log errors properly

## Getting Help

- Join our Discord server
- Check existing issues
- Ask questions in discussions
- Contact maintainers

## License

By contributing, you agree that your contributions will be licensed under the project's license.

---

Thank you for contributing to Rezepta! Your efforts help make this project better for everyone. 
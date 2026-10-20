# 贡献指南 / Contributing Guide

感谢您考虑为 RocketMQ Dashboard Desktop 做出贡献！

Thank you for considering contributing to RocketMQ Dashboard Desktop!

---

## 🌍 语言 / Language

- [简体中文](#简体中文)
- [English](#english)

---

## 简体中文

### 如何贡献

我们欢迎各种形式的贡献：

- 🐛 **报告 Bug** - 发现问题请提交 Issue
- ✨ **提出新功能** - 有好的想法请告诉我们
- 📝 **改进文档** - 发现文档错误或不清晰的地方
- 💻 **提交代码** - 修复 Bug 或实现新功能

### 开发流程

#### 1. Fork 并克隆项目

```bash
# Fork 本仓库到你的 GitHub 账号
# 然后克隆你的 Fork
git clone https://github.com/your-username/rocketmq-dashboard-desktop.git
cd rocketmq-dashboard-desktop
```

#### 2. 创建分支

```bash
# 创建功能分支
git checkout -b feature/amazing-feature

# 或创建修复分支
git checkout -b fix/bug-description
```

#### 3. 安装依赖

```bash
npm install
```

#### 4. 开发

```bash
# 启动开发模式
npm run tauri dev

# 代码会自动热重载
```

#### 5. 测试

```bash
# Rust 单元测试
cd src-tauri
cargo test

# 前端测试
npm test

# 手工测试
# 按照 TEST_CHECKLIST.md 进行测试
```

#### 6. 提交

```bash
# 添加修改
git add .

# 提交（遵循 Conventional Commits 规范）
git commit -m "feat: add amazing feature"
git commit -m "fix: resolve connection timeout issue"
git commit -m "docs: update installation guide"
```

#### 7. 推送并创建 PR

```bash
# 推送到你的 Fork
git push origin feature/amazing-feature

# 在 GitHub 上创建 Pull Request
```

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（type）**：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例**：
```
feat(consumer): add consumer group delete functionality

- Add delete_consumer_group command in Rust
- Add delete button in ConsumersPage
- Add confirmation dialog

Closes #123
```

### 代码规范

#### TypeScript/React
- 使用 ESLint 和 Prettier（配置已内置）
- 组件使用函数式组件 + Hooks
- 使用 TypeScript 类型，避免 `any`
- 文件命名：PascalCase for components, camelCase for utils

#### Rust
- 使用 `cargo fmt` 格式化代码
- 使用 `cargo clippy` 检查代码
- 遵循 Rust 官方风格指南
- 添加必要的注释和文档

#### 通用规范
- 保持代码简洁易读
- 添加必要的注释
- 遵循现有代码风格
- 避免不必要的依赖

### Pull Request 检查清单

提交 PR 前，请确保：

- [ ] 代码已通过 `cargo fmt` 和 `cargo clippy` 检查
- [ ] TypeScript 代码无编译错误
- [ ] 添加了必要的测试
- [ ] 测试全部通过
- [ ] 更新了相关文档
- [ ] 提交信息符合规范
- [ ] PR 描述清晰，说明了改动内容和原因

### 报告 Bug

提交 Bug 时，请包含：

1. **Bug 描述** - 简洁清晰的描述
2. **重现步骤** - 如何触发这个 Bug
3. **预期行为** - 应该发生什么
4. **实际行为** - 实际发生了什么
5. **环境信息**：
   - 操作系统及版本
   - 应用版本
   - RocketMQ 版本
6. **截图/日志** - 如果有的话
7. **其他信息** - 任何可能有帮助的信息

### 提出功能请求

提交功能请求时，请包含：

1. **功能描述** - 你想要什么功能
2. **使用场景** - 为什么需要这个功能
3. **建议方案** - 如何实现（可选）
4. **替代方案** - 是否有其他解决方法（可选）

---

## English

### How to Contribute

We welcome all forms of contributions:

- 🐛 **Report Bugs** - Found an issue? Submit an Issue
- ✨ **Suggest Features** - Have a great idea? Let us know
- 📝 **Improve Documentation** - Found errors or unclear parts
- 💻 **Submit Code** - Fix bugs or implement features

### Development Workflow

#### 1. Fork and Clone

```bash
# Fork this repository to your GitHub account
# Then clone your fork
git clone https://github.com/your-username/rocketmq-dashboard-desktop.git
cd rocketmq-dashboard-desktop
```

#### 2. Create Branch

```bash
# Create feature branch
git checkout -b feature/amazing-feature

# Or create fix branch
git checkout -b fix/bug-description
```

#### 3. Install Dependencies

```bash
npm install
```

#### 4. Develop

```bash
# Start development mode
npm run tauri dev

# Code will auto-reload
```

#### 5. Test

```bash
# Rust unit tests
cd src-tauri
cargo test

# Frontend tests
npm test

# Manual testing
# Follow TEST_CHECKLIST.md
```

#### 6. Commit

```bash
# Stage changes
git add .

# Commit (follow Conventional Commits)
git commit -m "feat: add amazing feature"
git commit -m "fix: resolve connection timeout issue"
git commit -m "docs: update installation guide"
```

#### 7. Push and Create PR

```bash
# Push to your fork
git push origin feature/amazing-feature

# Create Pull Request on GitHub
```

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation update
- `style`: Code format (no code logic change)
- `refactor`: Refactoring
- `perf`: Performance optimization
- `test`: Test related
- `chore`: Build process or auxiliary tools

**Example**:
```
feat(consumer): add consumer group delete functionality

- Add delete_consumer_group command in Rust
- Add delete button in ConsumersPage
- Add confirmation dialog

Closes #123
```

### Code Style

#### TypeScript/React
- Use ESLint and Prettier (configured)
- Use functional components + Hooks
- Use TypeScript types, avoid `any`
- File naming: PascalCase for components, camelCase for utils

#### Rust
- Use `cargo fmt` for formatting
- Use `cargo clippy` for linting
- Follow Rust official style guide
- Add necessary comments and docs

#### General
- Keep code clean and readable
- Add necessary comments
- Follow existing code style
- Avoid unnecessary dependencies

### Pull Request Checklist

Before submitting PR, ensure:

- [ ] Code passes `cargo fmt` and `cargo clippy`
- [ ] TypeScript code compiles without errors
- [ ] Added necessary tests
- [ ] All tests pass
- [ ] Updated relevant documentation
- [ ] Commit messages follow convention
- [ ] PR description is clear and explains changes

### Reporting Bugs

When reporting bugs, include:

1. **Bug Description** - Clear and concise description
2. **Reproduction Steps** - How to trigger the bug
3. **Expected Behavior** - What should happen
4. **Actual Behavior** - What actually happened
5. **Environment**:
   - OS and version
   - App version
   - RocketMQ version
6. **Screenshots/Logs** - If available
7. **Additional Info** - Any other helpful information

### Requesting Features

When requesting features, include:

1. **Feature Description** - What feature you want
2. **Use Case** - Why this feature is needed
3. **Proposed Solution** - How to implement (optional)
4. **Alternatives** - Other possible solutions (optional)

---

## 📧 Contact

- **Issues**: [GitHub Issues](https://github.com/your-username/rocketmq-dashboard-desktop/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/rocketmq-dashboard-desktop/discussions)

---

## 🙏 Thank You!

Every contribution, no matter how small, is valued and appreciated!

感谢你的贡献，无论大小，我们都非常感激！

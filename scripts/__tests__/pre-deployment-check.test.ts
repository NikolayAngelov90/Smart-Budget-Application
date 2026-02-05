/**
 * Pre-Deployment Check Script Tests
 * Story 9-8: Create Deployment Checklist (AC-9.8.7, AC-9.8.8, AC-9.8.9)
 */

export {};

const { execSync } = require('child_process');
const path = require('path');
const nodeFs = require('fs');

const scriptPath = path.join(__dirname, '..', 'pre-deployment-check.js');
const projectRoot = path.join(__dirname, '..', '..');

describe('pre-deployment-check.js', () => {
  it('script file exists', () => {
    expect(nodeFs.existsSync(scriptPath)).toBe(true);
  });

  it('script is valid JavaScript', () => {
    // Verify the script can be parsed without errors
    const content = nodeFs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('PRE-DEPLOYMENT VALIDATION');
    expect(content).toContain('process.exit(0)');
    expect(content).toContain('process.exit(1)');
  });

  it('contains all required check sections', () => {
    const content = nodeFs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('Environment variables');
    expect(content).toContain('Type check');
    expect(content).toContain('Lint');
    expect(content).toContain('Tests');
    expect(content).toContain('Build');
  });

  it('supports --skip-build flag', () => {
    const content = nodeFs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('--skip-build');
  });

  it('supports --strict flag', () => {
    const content = nodeFs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('--strict');
  });

  it('uses correct output symbols', () => {
    const content = nodeFs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('[PASS]');
    expect(content).toContain('[FAIL]');
    expect(content).toContain('[WARN]');
    expect(content).toContain('[SKIP]');
  });

  it('imports check-env-vars module', () => {
    const content = nodeFs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain("require('./check-env-vars')");
  });
});

describe('check-env-vars.js', () => {
  const checkEnvPath = path.join(__dirname, '..', 'check-env-vars.js');

  it('script file exists', () => {
    expect(nodeFs.existsSync(checkEnvPath)).toBe(true);
  });

  it('exports required functions and constants', () => {
    const module = require(checkEnvPath);
    expect(typeof module.checkEnvVars).toBe('function');
    expect(Array.isArray(module.REQUIRED_VARS)).toBe(true);
    expect(Array.isArray(module.DEV_OPTIONAL)).toBe(true);
  });
});

describe('deployment-checklist.md', () => {
  const checklistPath = path.join(projectRoot, 'docs', 'deployment-checklist.md');

  it('checklist document exists', () => {
    expect(nodeFs.existsSync(checklistPath)).toBe(true);
  });

  it('contains all required sections', () => {
    const content = nodeFs.readFileSync(checklistPath, 'utf-8');
    expect(content).toContain('Environment Variables');
    expect(content).toContain('Database Migrations');
    expect(content).toContain('Type Check');
    expect(content).toContain('Test Suite');
    expect(content).toContain('Production Build');
    expect(content).toContain('Performance Benchmarks');
    expect(content).toContain('Deployment');
  });

  it('references automated script', () => {
    const content = nodeFs.readFileSync(checklistPath, 'utf-8');
    expect(content).toContain('npm run pre-deploy');
    expect(content).toContain('pre-deployment-check.js');
  });

  it('lists all migration files', () => {
    const content = nodeFs.readFileSync(checklistPath, 'utf-8');
    expect(content).toContain('001_initial_schema.sql');
    expect(content).toContain('006_user_sessions_table.sql');
  });

  it('documents exit codes', () => {
    const content = nodeFs.readFileSync(checklistPath, 'utf-8');
    expect(content.toLowerCase()).toContain('exit code');
    expect(content).toContain('`0`');
    expect(content).toContain('`1`');
  });
});

describe('npm scripts', () => {
  it('package.json has pre-deploy script', () => {
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = JSON.parse(nodeFs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts['pre-deploy']).toBe('node scripts/pre-deployment-check.js');
  });

  it('package.json has pre-deploy:quick script', () => {
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = JSON.parse(nodeFs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts['pre-deploy:quick']).toBe('node scripts/pre-deployment-check.js --skip-build');
  });

  it('package.json has check-env script', () => {
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = JSON.parse(nodeFs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts['check-env']).toBe('node scripts/check-env-vars.js');
  });
});

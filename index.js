#!/usr/bin/env node

// node modules
import { exec, execSync } from 'child_process';
import fs from 'fs';
import inquirer from 'inquirer';

// local modules
import { mongoLibJS, mongoLibTS } from './mongoclient.js';

(async () => {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'What is the name of your Next.js project?',
      default: 'my-next-app'
    },
    {
      type: 'confirm',
      name: 'useTypeScript',
      message: 'Would you like to use TypeScript?',
      default: true
    },
    {
      type: 'confirm',
      name: 'useESLint',
      message: 'Would you like to use ESLint?',
      default: true
    },
    {
      type: 'confirm',
      name: 'useTailwindCSS',
      message: 'Would you like to use Tailwind CSS?',
      default: true
    },
    {
      type: 'confirm',
      name: 'appRouter',
      message: 'Would you like use the default app router? (recommended)',
      default: true
    },
    {
      type: 'confirm',
      name: 'srcDir',
      message: 'Would you like to use a create source directory?',
      default: false
    },
    {
      type: 'input',
      name: 'importAlias',
      message: 'Custom import alias (e.g., "@/*") or leave blank for default:',
      default: '@/*',
    },
    {
      type: 'confirm',
      name: 'useTurbo',
      message: 'Enable Turbopack by default for development? (beta)',
      default: false
    },
    {
      type: 'list',
      name: 'packageManager',
      message: 'Which package manager would you like to use?',
      choices: ['npm', 'yarn', 'pnpm', 'bun'],
      default: 'npm'
    },
    {
      type: 'checkbox',
      name: 'authProviders',
      message: 'Which NextAuth providers would you like to add?',
      choices: ['GitHub', 'Google'],
      default: ['Google']
    },
    {
      type: 'confirm',
      name: 'useMongoAdapter',
      message: 'Would you like to use the MongoDB adapter?',
      default: false
    }
  ]);

  const { projectName, useTypeScript, importAlias, authProviders, useMongoAdapter, useESLint, useTailwindCSS, appRouter, srcDir, packageManager, useTurbo } = answers;

  const tsFlag = useTypeScript ? '--ts' : '--js';
  const eslintFlag = useESLint ? '--eslint' : '--no-eslint';
  const tailwindFlag = useTailwindCSS ? '--tailwind' : '--no-tailwind';
  const appRouterFlag = appRouter ? '--app' : '--no-app';
  const srcDirFlag = srcDir ? '--src-dir' : '--no-src-dir';
  const packageManagerFlag = `--use-${packageManager}`;
  const turboFlag = useTurbo ? '--turbo' : '';
  const importAliasFlag = `--import-alias ${importAlias}`
  console.log(`Creating a Next.js app named: ${projectName}`);

  execSync(`npx create-next-app@latest ${projectName} ${appRouterFlag} ${tsFlag} ${eslintFlag} ${tailwindFlag} ${srcDirFlag} ${importAliasFlag} ${packageManagerFlag} ${turboFlag}`, { stdio: 'inherit' });

  process.chdir(projectName);

  console.log('Installing NextAuth.js and dependencies...');
  let installCmd = (packageManager === 'npm') ? 'npm install next-auth' : `${packageManager} add next-auth`;
  if (useMongoAdapter) {
    installCmd += ' @next-auth/mongodb-adapter mongodb';
  }
  execSync(installCmd, { stdio: 'inherit' });

  console.log('Configuring NextAuth.js...');

  const nextAuthConfigPath = `.${srcDir ? `/src/` : '/'}${appRouter ? 'app' : 'pages'}/api/auth/[...nextauth]${appRouter ? `/route.${useTypeScript ? 'ts' : 'js'}` : `.${useTypeScript ? 'ts' : 'js'}`}`;

  // Create the file structure
  fs.mkdirSync(`.${srcDir ? '/src' : ''}/${appRouter ? 'app' : 'pages'}/api/auth/${appRouter ? '[...nextauth]' : ''}`, { recursive: true });
  fs.writeFileSync(nextAuthConfigPath, nextAuthConfig(authProviders, useMongoAdapter, importAlias));

  if (useMongoAdapter) {
    fs.mkdirSync(`.${srcDir ? `/src` : ``}/lib`, { recursive: true });
    fs.writeFileSync(`.${srcDir ? `/src` : ``}/lib/mongodb.${useTypeScript ? `ts` : `js`}`, useTypeScript ? mongoLibTS : mongoLibJS);
  }

  if (importAlias) {
    const tsconfigPath = './tsconfig.json';
    if (fs.existsSync(tsconfigPath)) {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      tsconfig.compilerOptions.paths = {
        [importAlias]: ['./src/*'],
      };
      fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    }
  }

  execSync(`git commit -am "Add NextAuth.js"`, { stdio: 'inherit' });

  console.log(`\nNext steps: \n
  1. Navigate to your project: cd ${projectName}
  2. Add environment variables(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, etc.) in .env.local
  3. If using MongoDB, add MONGODB_URI to .env.local
  4. Start your development server: npm run dev
    `);
})();


function nextAuthConfig(authProviders, useMongoAdapter, alias) {
  let providersConfig = '';
  if (authProviders.includes('GitHub')) {
    providersConfig += `
      GithubProvider({
        clientId: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || ''
      }),`;
  }
  if (authProviders.includes('Google')) {
    providersConfig += `
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
      }),`;
  }

  return `
  import NextAuth from 'next-auth';
  ${authProviders.includes('GitHub') ? "import GithubProvider from 'next-auth/providers/github';" : ''}
  ${authProviders.includes('Google') ? "import GoogleProvider from 'next-auth/providers/google';" : ''}
  ${useMongoAdapter ? `import { MongoDBAdapter } from '@next-auth/mongodb-adapter'; 
  import clientPromise from '${alias.slice(0, -1)}lib/mongodb';` : ''}
  
  export default NextAuth({
    providers: [${providersConfig}],
    ${useMongoAdapter ? "adapter: MongoDBAdapter(clientPromise)," : ''}
  });
    `;
}
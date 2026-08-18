const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '../src/app/api');
const tempApiDir = path.join(__dirname, '../src/app/api_temp');

let apiMoved = false;

try {
  // 1. Move API directory out of app router temporarily
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, tempApiDir);
    apiMoved = true;
    console.log('Temporarily moved API directory to prevent static export errors.');
  }

  // 2. Run Next.js static export build
  console.log('Running Next.js static export build...');
  execSync('npx cross-env EXPORT=true next build', { stdio: 'inherit' });

  console.log('Static export build completed successfully.');
} catch (error) {
  if (error.code === 'EPERM') {
    console.error('\n==================================================================');
    console.error('ERROR: Permission Denied (EPERM) while moving "src/app/api"');
    console.error('This is because your Next.js Dev Server (npm run dev) is active');
    console.error('and holding a lock on the api folder structure.');
    console.error('To compile this static export build locally:');
    console.error('  1. Stop your running dev server in the terminal (Ctrl + C).');
    console.error('  2. Run "npm run mobile:build" again.');
    console.error('  3. Restart the dev server using "npm run dev".');
    console.error('\nNOTE: This build works automatically without changes on GitHub Actions!');
    console.error('==================================================================\n');
  } else {
    console.error('Build failed:', error);
  }
  process.exitCode = 1;
} finally {
  // 3. Restore API directory
  if (apiMoved && fs.existsSync(tempApiDir)) {
    try {
      fs.renameSync(tempApiDir, apiDir);
      console.log('Restored API directory back to src/app/api.');
    } catch (restoreError) {
      console.error('Failed to restore API directory. Please manually rename src/app/api_temp to src/app/api.', restoreError);
    }
  }
}

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const androidDir = path.join(rootDir, 'android');
const appBuildGradlePath = path.join(androidDir, 'app/build.gradle');
const projectBuildGradlePath = path.join(androidDir, 'build.gradle');
const googleServicesDest = path.join(androidDir, 'app/google-services.json');

// 1. Copy or write google-services.json
const googleServicesSrc = path.join(rootDir, 'google-services.json');
if (fs.existsSync(googleServicesSrc)) {
  fs.copyFileSync(googleServicesSrc, googleServicesDest);
  console.log('Successfully copied google-services.json to android/app/google-services.json');
} else if (process.env.GOOGLE_SERVICES_JSON) {
  fs.writeFileSync(googleServicesDest, process.env.GOOGLE_SERVICES_JSON, 'utf8');
  console.log('Successfully wrote google-services.json from env to android/app/google-services.json');
} else {
  console.warn('WARNING: google-services.json was not found in root or GOOGLE_SERVICES_JSON env variables.');
}

// 2. Add dependencies classpath to project build.gradle
if (fs.existsSync(projectBuildGradlePath)) {
  let content = fs.readFileSync(projectBuildGradlePath, 'utf8');
  if (!content.includes('com.google.gms:google-services')) {
    const dependenciesRegex = /(buildscript\s*\{[\s\S]*?dependencies\s*\{)/;
    if (dependenciesRegex.test(content)) {
      content = content.replace(
        dependenciesRegex,
        `$1\n        classpath 'com.google.gms:google-services:4.4.1'`
      );
      fs.writeFileSync(projectBuildGradlePath, content, 'utf8');
      console.log('Successfully added google-services classpath to project build.gradle');
    } else {
      console.error('ERROR: Could not match buildscript dependencies in project build.gradle');
    }
  } else {
    console.log('google-services classpath already exists in project build.gradle');
  }
} else {
  console.error('ERROR: project-level build.gradle not found.');
}

// 3. Apply Google services plugin in app build.gradle
if (fs.existsSync(appBuildGradlePath)) {
  let content = fs.readFileSync(appBuildGradlePath, 'utf8');
  if (!content.includes("com.google.gms.google-services")) {
    content += "\napply plugin: 'com.google.gms.google-services'\n";
    fs.writeFileSync(appBuildGradlePath, content, 'utf8');
    console.log('Successfully applied google-services plugin to app build.gradle');
  } else {
    console.log('google-services plugin already exists in app build.gradle');
  }
} else {
  console.error('ERROR: app-level build.gradle not found.');
}

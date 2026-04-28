const { App } = require('aws-cdk-lib');
const { HoopsStack } = require('../lib/hoops-stack');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const app = new App();

new HoopsStack(app, 'HoopsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-2',
  },
  // Pull secrets from your existing server/.env
  adminPassword: process.env.ADMIN_PASSWORD,
  gmailUser: process.env.GMAIL_USER,
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD,
  adminEmail: process.env.ADMIN_EMAIL,
});

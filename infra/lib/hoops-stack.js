const { Stack, Duration, RemovalPolicy, CfnOutput } = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const events = require('aws-cdk-lib/aws-events');
const targets = require('aws-cdk-lib/aws-events-targets');
const s3 = require('aws-cdk-lib/aws-s3');
const s3deploy = require('aws-cdk-lib/aws-s3-deployment');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
const path = require('path');

class HoopsStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { adminPassword, gmailUser, gmailAppPassword, adminEmail } = props;

    // ── DynamoDB ─────────────────────────────────────────────────────────────
    const table = new dynamodb.Table(this, 'HoopsTable', {
      tableName: 'hoops-signup',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // GSI to query all signups by phone number (for dashboard stats)
    table.addGlobalSecondaryIndex({
      indexName: 'phone-index',
      partitionKey: { name: 'phone', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'weekOf', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['name', 'cancelled', 'maybe', 'signedUpAt'],
    });

    // ── S3 + CloudFront: React frontend ───────────────────────────────────────
    // Created first so we can pass the CloudFront URL to Lambda env vars
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ── API Gateway ───────────────────────────────────────────────────────────
    const api = new apigateway.RestApi(this, 'HoopsApi', {
      restApiName: 'hoops-signup-api',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'x-admin-password'],
      },
    });

    // ── Shared Lambda environment ─────────────────────────────────────────────
    // SITE_URL will be the CloudFront domain — used in reminder emails
    // We reference the distribution domain after creating it below
    const commonEnv = {
      DYNAMODB_TABLE: table.tableName,
      ADMIN_PASSWORD: adminPassword,
      GMAIL_USER: gmailUser,
      GMAIL_APP_PASSWORD: gmailAppPassword,
      ADMIN_EMAIL: adminEmail,
      // Set after CloudFront is created via CfnOutput / we use a placeholder
      // and update via cdk deploy after first run — or we hardcode the CF domain
    };

    const lambdaDefaults = {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../server')),
      timeout: Duration.seconds(15),
      memorySize: 256,
    };

    // ── Lambda functions ──────────────────────────────────────────────────────
    const signupFn = new lambda.Function(this, 'SignupHandler', {
      ...lambdaDefaults,
      handler: 'handlers/signup.handler',
      environment: commonEnv,
    });
    table.grantReadWriteData(signupFn);

    const adminFn = new lambda.Function(this, 'AdminHandler', {
      ...lambdaDefaults,
      handler: 'handlers/admin.handler',
      environment: commonEnv,
    });
    table.grantReadWriteData(adminFn);

    const schedulerFn = new lambda.Function(this, 'SchedulerHandler', {
      ...lambdaDefaults,
      handler: 'handlers/scheduler.handler',
      environment: commonEnv,
    });
    table.grantReadData(schedulerFn);

    // ── API Gateway routes ────────────────────────────────────────────────────
    const signupIntegration = new apigateway.LambdaIntegration(signupFn);
    const adminIntegration = new apigateway.LambdaIntegration(adminFn);

    // All routes live under /api to match the CloudFront /api/* behavior
    const apiRoot = api.root.addResource('api');

    const signupResource = apiRoot.addResource('signup');
    signupResource.addMethod('GET', signupIntegration);
    signupResource.addMethod('POST', signupIntegration);

    const cancelByPhone = signupResource.addResource('cancel-by-phone');
    cancelByPhone.addMethod('POST', signupIntegration);

    const cancelResource = signupResource.addResource('cancel');
    const cancelToken = cancelResource.addResource('{token}');
    cancelToken.addMethod('GET', signupIntegration);
    cancelToken.addMethod('POST', signupIntegration);

    const adminResource = apiRoot.addResource('admin');
    const adminSignups = adminResource.addResource('signups');
    adminSignups.addMethod('GET', adminIntegration);
    adminSignups.addMethod('POST', adminIntegration);
    const adminSignupPhone = adminSignups.addResource('{phone}');
    adminSignupPhone.addMethod('DELETE', adminIntegration);

    const adminStats = adminResource.addResource('stats');
    adminStats.addMethod('GET', adminIntegration);

    const adminPlayers = adminResource.addResource('players');
    adminPlayers.addMethod('GET', adminIntegration);
    adminPlayers.addMethod('POST', adminIntegration);
    const adminPlayerPhone = adminPlayers.addResource('{phone}');
    adminPlayerPhone.addMethod('PATCH', adminIntegration);
    adminPlayerPhone.addMethod('DELETE', adminIntegration);
    const adminPlayerHistory = adminPlayerPhone.addResource('history');
    adminPlayerHistory.addMethod('DELETE', adminIntegration);

    // ── CloudFront distribution ───────────────────────────────────────────────
    // API Gateway origin — strips the /prod stage prefix via path rewrite
    const apiOrigin = new origins.HttpOrigin(
      `${api.restApiId}.execute-api.${this.region}.amazonaws.com`,
      { originPath: '/prod' }
    );

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      defaultBehavior: {
        // Default: serve React app from S3
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        // /api/* → API Gateway (no caching)
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // Now that we have the CloudFront domain, set SITE_URL on all Lambdas
    const siteUrl = `https://${distribution.distributionDomainName}`;
    [signupFn, adminFn, schedulerFn].forEach(fn => {
      fn.addEnvironment('SITE_URL', siteUrl);
    });

    // ── S3 deployment ─────────────────────────────────────────────────────────
    new s3deploy.BucketDeployment(this, 'SiteDeploy', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../client/dist'))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // ── EventBridge scheduled reminders ──────────────────────────────────────
    // Saturday 12:30pm CT = 17:30 UTC (CDT/summer) — email with Sunday reminder to copy/paste
    new events.Rule(this, 'SundayReminderRule', {
      ruleName: 'hoops-sunday-reminder',
      schedule: events.Schedule.cron({ minute: '30', hour: '17', weekDay: 'SAT' }),
      targets: [new targets.LambdaFunction(schedulerFn, {
        event: events.RuleTargetInput.fromObject({ 'detail-type': 'sunday-reminder' }),
      })],
    });

    // Monday 7:30am CT = 12:30 UTC (CDT/summer) — email with day-of reminder
    new events.Rule(this, 'MondayReminderRule', {
      ruleName: 'hoops-monday-reminder',
      schedule: events.Schedule.cron({ minute: '30', hour: '12', weekDay: 'MON' }),
      targets: [new targets.LambdaFunction(schedulerFn, {
        event: events.RuleTargetInput.fromObject({ 'detail-type': 'monday-reminder' }),
      })],
    });

    // Monday 12:00pm CT = 17:00 UTC (CDT/summer) — email with count-based nudge
    new events.Rule(this, 'MondayNoonReminderRule', {
      ruleName: 'hoops-monday-noon-reminder',
      schedule: events.Schedule.cron({ minute: '0', hour: '17', weekDay: 'MON' }),
      targets: [new targets.LambdaFunction(schedulerFn, {
        event: events.RuleTargetInput.fromObject({ 'detail-type': 'monday-noon-reminder' }),
      })],
    });

    // ── Outputs ───────────────────────────────────────────────────────────────
    new CfnOutput(this, 'SiteUrl', {
      value: siteUrl,
      description: 'Your app URL',
    });

    new CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID',
    });
  }
}

module.exports = { HoopsStack };

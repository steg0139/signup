# 🏀 Monday Hoops Signup

Weekly pickup basketball signup site. Players sign up and can cancel. Admin manages the list and roster. Automated reminder emails go out before each game.

## Stack

- **Frontend** — React + Vite, hosted on S3 + CloudFront
- **Backend** — Node.js Lambda functions behind API Gateway
- **Database** — DynamoDB (single table)
- **Email** — Nodemailer via Gmail
- **Infrastructure** — AWS CDK

## Setup

### 1. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### 2. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
cd ../infra && npm install
```

### 3. Deploy to AWS

```bash
# Build the React app
cd client && npm run build && cd ..

# Bootstrap CDK (one-time per account/region)
cdk bootstrap

# Deploy everything
cdk deploy
```

CDK will output your CloudFront URL — that's your app.

## Local development

```bash
# Terminal 1 — server (runs on port 3002)
cd server && npm run dev

# Terminal 2 — client (runs on port 5174, proxies /api to server)
cd client && npm run dev
```

## How it works

- **Signup page** — players enter name + phone number to claim a spot (max 15)
- **Maybe** — players can sign up as a maybe; shown separately with a different color
- **Cancel** — via the unique link on the confirmation page, or by entering their phone number on the site
- **Admin page** — view/manage this week's list, manually add/remove players, manage the roster
- **Reminder emails** — Saturday 12:30pm: signup open reminder to copy/paste to your group chat. Monday 8:30am: day-of reminder with current signup list.
- **Weekly reset** — signup list automatically resets each week (queries by upcoming Monday's date)

## Deploying updates

```bash
cd client && npm run build && cd ..
cdk deploy
```

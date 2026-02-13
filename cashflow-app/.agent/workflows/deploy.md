---
description: Deploy the cashflow-app to Vercel production
---

# Deploy to Vercel

This workflow deploys the cashflow-app to Vercel production.

## Prerequisites
- You must be logged into Vercel CLI (`npx vercel login`)

## Steps

// turbo-all

1. Navigate to the cashflow-app directory:
   ```
   cd cashflow-app
   ```

2. Deploy to production:
   ```
   npx vercel --prod
   ```

3. The deployment URL will be displayed upon completion.

## Notes
- The production URL is: https://cashflow-app-eight.vercel.app
- Each deployment takes approximately 1-2 minutes

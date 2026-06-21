Setup Vercel Preview Deployments

This document explains how to set up preview deployments for pull requests using Vercel and GitHub Actions.

## Overview

Every pull request gets an automatic preview deployment. The deployment URL is posted in a PR comment for easy review. After merging, the preview is automatically cleaned up.

## Prerequisites

- A Vercel account with the Oryn Finance project linked
- GitHub repository secrets configured

## GitHub Secrets Configuration

Add the following secrets to your GitHub repository:

### `VERCEL_TOKEN`
Your Vercel authentication token for CI/CD deployments.

**How to get it:**
1. Go to [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Click "Create Token"
3. Name it (e.g., "GitHub CI")
4. Set expiration (recommended: 365 days)
5. Copy the token
6. Add to GitHub Secrets as `VERCEL_TOKEN`

### `VERCEL_ORG_ID`
Your Vercel organization ID.

**How to get it:**
1. Go to [vercel.com/account/general](https://vercel.com/account/general)
2. Scroll to "Organization ID"
3. Copy the value
4. Add to GitHub Secrets as `VERCEL_ORG_ID`

### `VERCEL_PROJECT_ID`
The Vercel project ID for Oryn Finance.

**How to get it:**
1. Go to your Vercel project settings
2. Go to the "General" tab
3. Find "Project ID" and copy it
4. Add to GitHub Secrets as `VERCEL_PROJECT_ID`

## How It Works

### On Pull Request Creation/Update

1. GitHub Actions runs the deployment job
2. Frontend is built with Vite
3. Build output is deployed to Vercel
4. A comment is posted on the PR with the preview URL
5. The comment is updated on subsequent pushes

### On PR Merge

1. GitHub Actions runs the cleanup job
2. The preview deployment is removed from Vercel
3. The PR comment is updated to indicate removal

## Configuration Files

### `.github/workflows/preview-deployment.yml`
Main workflow that handles deployment and cleanup.

### `frontend/vercel.json`
Vercel configuration for the frontend:
- Enables rewrites for React Router (SPA routing)
- All routes redirect to `index.html`

## Environment Variables

The following environment variables are used during preview builds:

- `VITE_API_URL`: Backend API URL (use Vercel environment variables)
- `VITE_WS_URL`: WebSocket URL (use Vercel environment variables)

These can be set in your Vercel project settings under "Environment Variables".

## Verifying Setup

1. Create a test pull request with a small change
2. Wait for the workflow to complete (check the Actions tab)
3. Look for the preview deployment comment on the PR
4. Click the URL to verify the preview loads correctly
5. Merge the PR to verify cleanup works

## Troubleshooting

### Workflow fails with "VERCEL_TOKEN not found"
- Add the `VERCEL_TOKEN` secret to your repository settings
- GitHub Secrets → New repository secret

### Deployment fails with "Not found" error
- Verify `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are correct
- Check that the Vercel project is linked to this GitHub repository

### Preview URL shows 404
- Ensure `frontend/vercel.json` includes the rewrites configuration
- This is necessary for React Router to handle client-side routing

### Cleanup fails but PR shows as merged
- The cleanup job runs asynchronously; failures don't block the merge
- Check the workflow logs to see what went wrong
- You can manually delete the deployment from the Vercel dashboard

## Security Notes

- `VERCEL_TOKEN` is sensitive and should only be available to trusted workflows
- Preview deployments are created with the same environment variables as your Vercel project settings
- Secrets used in Vercel environment variables are not exposed in preview deployment URLs

## Additional Resources

- [Vercel Deployment Documentation](https://vercel.com/docs/deployments)
- [Vercel CLI Deploy Command](https://vercel.com/docs/cli/deploy)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)

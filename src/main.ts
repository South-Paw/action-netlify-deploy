import * as core from '@actions/core';
import * as github from '@actions/github';
import NetlifyAPI from 'netlify';
import * as path from 'path';
import { createCommentMessage, getDeployUrl } from './util';

const dryRunDeploy = {
  name: 'dry-run',
  deploy_ssl_url: 'http://example.com',
  ssl_url: 'http://example.com',
};

async function run(): Promise<void> {
  try {
    const isCommit = Object.keys(github.context.payload).includes('head_commit');
    const isPullRequest = Object.keys(github.context.payload).includes('pull_request');
    const isRelease = Object.keys(github.context.payload).includes('release');

    const commitSha = github.context.sha;
    const commitShaShort = github.context.sha.slice(0, 7);
    const commitMessage = isCommit ? github.context.payload?.head_commit?.message : undefined;
    const pullRequestNumber = github.context.payload.pull_request?.number;
    const pullRequestTitle = isPullRequest ? github.context.payload?.pull_request?.title : undefined;
    const releaseTag = isRelease ? github.context.payload?.release?.tag_name : undefined;
    const releaseTitle = isRelease ? github.context.payload?.release?.name : undefined;

    // Get required inputs
    const githubToken = core.getInput('github-token', { required: true });
    const netlifyAuthToken = core.getInput('netlify-auth-token', { required: true });
    const siteId = core.getInput('netlify-site-id', { required: true });
    const buildDir = core.getInput('build-dir', { required: true });

    // Get config inputs
    const commentOnCommit = core.getInput('comment-on-commit') === 'true';
    const commentOnPullRequest = core.getInput('comment-on-pull-request') === 'true';
    const githubEnv = core.getInput('github-env') || undefined;
    const githubEnvReportStatus = core.getInput('github-env-report-status') === 'true';
    const dryRun = core.getInput('dry-run') === 'true';

    // Get optional inputs
    const configPath = core.getInput('config-path') || undefined;
    const draft = core.getInput('draft') === 'true';
    const functionsDir = core.getInput('functions-dir') || undefined;
    let message = core.getInput('message');

    // If there's no explict deploy message input, then make a deploy message from the action's context.
    if (!message) {
      message = `Build [${commitShaShort}]`;

      if (isCommit) {
        message = `Commit: ${commitMessage} [${commitShaShort}]`;
      }

      if (isPullRequest) {
        message = `PR: ${pullRequestTitle} [${commitShaShort}]`;
      }

      if (isRelease) {
        message = `Release: ${releaseTitle} [${releaseTag}]`;
      }
    }

    if (dryRun) {
      process.stdout.write(`Action is running dry - there won't be any outputs from this run.\n`);
    }

    process.stdout.write(`Deploying ${draft ? 'draft ' : ''}to Netlify...\n`);

    const netlifyClient = new NetlifyAPI(netlifyAuthToken);

    let deploy;

    if (!dryRun) {
      try {
        const siteDir = path.resolve(process.cwd(), buildDir);
        const fnDir = functionsDir ? path.resolve(process.cwd(), functionsDir) : undefined;

        const deployment = await netlifyClient.deploy(siteId, siteDir, { configPath, draft, fnDir, message });

        deploy = deployment.deploy;
      } catch (error) {
        process.stderr.write('netlifyClient.deploy() failed\n');
        process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
        core.setFailed(error.message);
      }

      if (!deploy) {
        core.setFailed('Failed to deploy to Netlify!');
        return;
      }
    } else {
      process.stdout.write(`[Dry run] Netlify deploy message: "${message}"\n`);
    }

    const githubClient = github.getOctokit(githubToken);
    const body = createCommentMessage(draft, dryRun ? dryRunDeploy : deploy);

    if (isCommit && commentOnCommit) {
      process.stdout.write(`Commenting on commit ${commitShaShort} (SHA: ${commitSha})\n`);

      const {
        repo: { owner, repo },
        sha,
      } = github.context;

      if (!dryRun) {
        try {
          await githubClient.repos.createCommitComment({
            owner,
            repo,
            commit_sha: sha,
            body,
          });
        } catch (error) {
          process.stderr.write('creating commit comment failed\n');
          process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
          core.setFailed(error.message);
        }
      } else {
        process.stdout.write(`[Dry run] Github commit comment: "${body}"\n`);
      }
    }

    if (isPullRequest && commentOnPullRequest) {
      process.stdout.write(`Commenting on pull request #${pullRequestNumber}\n`);

      const {
        repo: { owner, repo },
        issue: { number },
      } = github.context;

      if (!dryRun) {
        try {
          await githubClient.issues.createComment({
            owner,
            repo,
            issue_number: number,
            body,
          });
        } catch (error) {
          process.stderr.write('creating pull request comment failed\n');
          process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
          core.setFailed(error.message);
        }
      } else {
        process.stdout.write(`[Dry run] Github pull request comment: "${body}"\n`);
      }
    }

    if (githubEnv) {
      if (!dryRun) {
        process.stdout.write(`Creating deployment for "${githubEnv}"\n`);

        const {
          ref,
          repo: { owner, repo },
        } = github.context;

        try {
          const deployment = await githubClient.repos.createDeployment({
            ref,
            owner,
            repo,
            environment: githubEnv,
            auto_merge: false,
            required_contexts: [],
          });

          await githubClient.repos.createDeploymentStatus({
            owner,
            repo,
            state: 'success',
            deployment_id: deployment.data.id,
            environment_url: getDeployUrl(draft, deploy),
          });
        } catch (error) {
          process.stderr.write('creating deployment failed\n');
          process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
          core.setFailed(error.message);
        }
      } else {
        process.stdout.write(`[Dry run] Github deployment env: "${githubEnv}"\n`);
      }

      if (!dryRun) {
        if (githubEnvReportStatus) {
          process.stdout.write(`Creating commit status for SHA: "${commitSha}"\n`);

          const {
            repo: { owner, repo },
          } = github.context;

          try {
            await githubClient.repos.createCommitStatus({
              sha: commitSha,
              owner,
              repo,
              state: 'success',
              context: 'action-netlify-deploy',
              target_url: getDeployUrl(draft, deploy),
              description: 'Netlify deployment status',
            });
          } catch (error) {
            process.stderr.write('creating deployment failed\n');
            process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
            core.setFailed(error.message);
          }
        }
      } else {
        process.stdout.write(`[Dry run] Github status on commit: "${commitSha}"\n`);
      }
    }
  } catch (error) {
    process.stderr.write(JSON.stringify(error, null, 2));
    core.setFailed(error.message);
  }
}

run();

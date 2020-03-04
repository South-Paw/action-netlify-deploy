import * as core from '@actions/core';
import * as github from '@actions/github';
import NetlifyAPI from 'netlify';
import * as path from 'path';
import { createCommentMessage, createDeployMessage } from './util';

async function run() {
  try {
    const isCommit = Object.keys(github.context.payload).includes('head_commit');
    const isPullRequest = Object.keys(github.context.payload).includes('pull_request');

    const commitSha = github.context.sha;
    const commitShaShort = github.context.sha.slice(0, 7);
    const commitMessage = isCommit ? github.context.payload?.head_commit?.message : undefined;
    const pullRequestNumber = github.context.payload.pull_request?.number;
    const pullRequestTitle = isPullRequest ? github.context.payload?.pull_request?.title : undefined;

    // Get required inputs
    const githubToken = core.getInput('github-token', { required: true });
    const netlifyAuthToken = core.getInput('netlify-auth-token', { required: true });
    const siteId = core.getInput('netlify-site-id', { required: true });
    const buildDir = core.getInput('build-dir', { required: true });

    // Get config inputs
    const commentOnCommit = core.getInput('comment-on-commit') === 'true';
    const commentOnPullRequest = core.getInput('comment-on-pull-request') === 'true';
    const dryRun = core.getInput('dry-run') === 'true';

    // Get optional inputs
    const functionsDir = core.getInput('functions-dir') || null;
    const configPath = core.getInput('config-path') || null;
    const draft = core.getInput('draft') === 'true';
    const message = core.getInput('message') || createDeployMessage(commitShaShort, commitMessage, pullRequestTitle);

    if (dryRun) {
      process.stdout.write(`Action is running dry - there won't be any outputs from this run.\n`);
    }

    process.stdout.write(`Deploying ${draft ? 'draft ' : ''}to Netlify...\n`);

    const netlifyClient = new NetlifyAPI(netlifyAuthToken);

    let deploy;

    if (!dryRun) {
      try {
        const deployment = await netlifyClient.deploy(siteId, path.resolve(process.cwd(), buildDir), {
          functionsDir,
          configPath,
          draft,
          message,
        });

        process.stdout.write(`${JSON.stringify(deployment, null, 2)}\n`);

        deploy = deployment.deploy;
      } catch (error) {
        process.stderr.write('netlifyClient.deploy() failed\n');
        process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
        core.setFailed(error.message);
      }
    }

    if (!deploy) {
      core.setFailed('Failed to deploy to Netlify!');
      return;
    }

    const githubClient = new github.GitHub(githubToken);

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
            body: createCommentMessage(draft, deploy),
          });
        } catch (error) {
          process.stderr.write('repos.createCommitComment() failed\n');
          process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
          core.setFailed(error.message);
        }
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
            body: createCommentMessage(draft, deploy),
          });
        } catch (error) {
          process.stderr.write('issues.createComment() failed\n');
          process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
          core.setFailed(error.message);
        }
      }
    }
  } catch (error) {
    process.stderr.write(JSON.stringify(error, null, 2));
    core.setFailed(error.message);
  }
}

run();

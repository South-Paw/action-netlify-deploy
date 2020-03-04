import * as path from 'path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import NetlifyAPI from 'netlify';

const createMessage = () => undefined;

async function run(): Promise<void> {
  try {
    // Get required action inputs
    // const githubToken = core.getInput('github-token', { required: true });
    const netlifyAuthToken = core.getInput('netlify-auth-token', { required: true });
    const siteId = core.getInput('netlify-site-id', { required: true });
    const buildDir = core.getInput('build-dir', { required: true });

    // Get optional action inputs
    const commentOnCommit = core.getInput('comment-on-commit') === 'true';
    const commentOnPullRequest = core.getInput('comment-on-pull-request') === 'true';
    const functionsDir = core.getInput('functions-dir') || null;
    const configPath = core.getInput('config-path') || null;
    const draft = core.getInput('draft') === 'true';
    const message = core.getInput('message') || createMessage();
    const deployTimeout = Number.parseInt(core.getInput('deploy-timeout'), 10) || 1.2e6;
    const parallelHash = Number.parseInt(core.getInput('parallel-hash'), 10) || 100;
    const parallelUpload = Number.parseInt(core.getInput('parallel-upload'), 10) || 15;
    const maxRetry = Number.parseInt(core.getInput('max-retry'), 10) || 5;

    const netlifyClient = new NetlifyAPI(netlifyAuthToken);

    // Deploy site
    // const deploy =
    await netlifyClient.deploy(siteId, path.resolve(process.cwd(), buildDir), {
      functionsDir,
      configPath,
      draft,
      message,
      deployTimeout,
      parallelHash,
      parallelUpload,
      maxRetry,
    });

    const isCommit = Object.keys(github.context.payload).includes('commits');
    const isPullRequest = Object.keys(github.context.payload).includes('pull_request');

    process.stdout.write(JSON.stringify({ isCommit, isPullRequest }, null, 2));

    if (isCommit && commentOnCommit) {
      process.stdout.write(`\ncomment on commit: ${github.context.sha}`);
    }

    if (isPullRequest && commentOnPullRequest) {
      process.stdout.write(`\ncomment on pull request: ${github.context.payload.pull_request?.number}`);
    }

    // Comment with deploy URL on PR
    // const githubClient = new github.GitHub(githubToken);

    // const { number, owner, repo } = github.context.issue;

    // const body = draft ? `` : ``;

    // if (number !== undefined) {
    //   await githubClient.issues.createComment({
    //     issue_number: number,
    //     owner,
    //     repo,
    //     body,
    //   });
    // }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

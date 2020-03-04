// import * as path from 'path';
import * as core from '@actions/core';
// import * as github from '@actions/github';
// import NetlifyAPI from 'netlify/dist/main';

const createMessage = () => {};

async function run(): Promise<void> {
  try {
    // Get environment variables
    const netlifyAuthToken = process.env.NETLIFY_AUTH_TOKEN;
    const siteId = process.env.NETLIFY_SITE_ID;

    if (!netlifyAuthToken && !siteId) {
      core.setFailed(`NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID are required env variables`);
    }

    // Get action inputs
    // const githubToken = core.getInput('github-token', { required: true });
    const buildDir = core.getInput('build-dir', { required: true });
    const functionsDir = core.getInput('functions-dir');
    const configPath = core.getInput('config-path');
    const draft = core.getInput('draft') === 'true';
    const message = core.getInput('message') || createMessage();
    const deployTimeout = Number.parseInt(core.getInput('deploy-timeout'), 10) || undefined;
    const parallelHash = Number.parseInt(core.getInput('parallel-hash'), 10) || undefined;
    const parallelUpload = Number.parseInt(core.getInput('parallel-upload'), 10) || undefined;
    const maxRetry = Number.parseInt(core.getInput('max-retry'), 10) || undefined;

    process.stdout.write(
      JSON.stringify(
        {
          buildDir,
          functionsDir,
          configPath,
          draft,
          message,
          deployTimeout,
          parallelHash,
          parallelUpload,
          maxRetry,
        },
        null,
        2,
      ),
    );

    // const netlifyClient = new NetlifyAPI(netlifyAuthToken);

    // // Deploy site
    // const deploy = await netlifyClient.deploy(siteId, path.resolve(process.cwd(), buildDir), {
    //   functionsDir,
    //   configPath,
    //   draft,
    //   message,
    //   deployTimeout,
    //   parallelHash,
    //   parallelUpload,
    //   maxRetry,
    // });

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

import * as path from 'path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import NetlifyAPI from 'netlify';

const createDeployMessage = (
  commitShaShort: string,
  commitMessage: string | undefined,
  pullRequestTitle: string | undefined,
) => {
  if (commitMessage) {
    return `${commitMessage} [${commitShaShort}]`;
  }

  if (commitMessage) {
    return `${pullRequestTitle} [${commitShaShort}]`;
  }

  return undefined;
};

/**
 * Netlify `createSiteDeploy` response.
 *
 * @see https://open-api.netlify.com/#operation/createSiteDeploy
 */
interface NetlifyDeploy {
  id: string;
  site_id: string;
  user_id: string;
  build_id: string;
  state: string;
  name: string;
  url: string;
  ssl_url: string;
  admin_url: string;
  deploy_url: string;
  deploy_ssl_url: string;
  screenshot_url: string;
  review_id: number;
  draft: boolean;
  required: string[];
  required_functions: string[];
  error_message: string;
  branch: string;
  commit_ref: string;
  commit_url: string;
  skipped: boolean;
  created_at: string;
  updated_at: string;
  published_at: string;
  title: string;
  context: string;
  locked: boolean;
  review_url: string;
  site_capabilities: object;
}

const createCommentMessage = (isDraft: boolean, deploy: NetlifyDeploy) =>
  isDraft
    ? `🚀 Netlify draft deployed to: ${deploy.deploy_ssl_url}`
    : `🎉 Netlify published ${deploy.name} to production.\nDeployed to: ${deploy.ssl_url}`;

async function run(): Promise<void> {
  try {
    const isCommit = Object.keys(github.context.payload).includes('head_commit');
    const isPullRequest = Object.keys(github.context.payload).includes('pull_request');

    const commitSha = github.context.sha;
    const commitShaShort = github.context.sha.slice(0, 7);
    const commitMessage = isCommit ? github.context.payload?.head_commit?.message : undefined;
    const pullRequestNumber = github.context.payload.pull_request?.number;
    const pullRequestTitle = isPullRequest ? github.context.payload?.pull_request?.title : undefined;

    process.stdout.write(
      JSON.stringify({ commitShaShort, commitMessage, pullRequestNumber, pullRequestTitle }, null, 2),
    );

    // Get required inputs
    const githubToken = core.getInput('github-token', { required: true });
    const netlifyAuthToken = core.getInput('netlify-auth-token', { required: true });
    const siteId = core.getInput('netlify-site-id', { required: true });
    const buildDir = core.getInput('build-dir', { required: true });

    // Get config inputs
    const commentOnCommit = core.getInput('comment-on-commit') === 'true';
    const commentOnPullRequest = core.getInput('comment-on-pull-request') === 'true';

    // Get optional inputs
    const functionsDir = core.getInput('functions-dir') || null;
    const configPath = core.getInput('config-path') || null;
    const draft = core.getInput('draft') === 'true';
    const message = core.getInput('message') || createDeployMessage(commitShaShort, commitMessage, pullRequestTitle);
    const deployTimeout = Number.parseInt(core.getInput('deploy-timeout'), 10) || 1.2e6;
    const parallelHash = Number.parseInt(core.getInput('parallel-hash'), 10) || 100;
    const parallelUpload = Number.parseInt(core.getInput('parallel-upload'), 10) || 15;
    const maxRetry = Number.parseInt(core.getInput('max-retry'), 10) || 5;

    const netlifyClient = new NetlifyAPI(netlifyAuthToken);

    process.stdout.write(`Deploying ${draft ? 'draft ' : ''}to Netlify...\n`);

    const { deploy } = await netlifyClient.deploy(siteId, path.resolve(process.cwd(), buildDir), {
      functionsDir,
      configPath,
      draft,
      message,
      deployTimeout,
      parallelHash,
      parallelUpload,
      maxRetry,
    });

    const githubClient = new github.GitHub(githubToken);

    if (isCommit && commentOnCommit) {
      process.stdout.write(`Commenting on commit SHA ${commitShaShort} (${commitSha})\n`);

      const {
        repo: { owner, repo },
        sha,
      } = github.context;

      await githubClient.repos.createCommitComment({
        owner,
        repo,
        commit_sha: sha,
        body: createCommentMessage(draft, deploy),
      });
    }

    if (isPullRequest && commentOnPullRequest) {
      process.stdout.write(`Commenting on pull request #${pullRequestNumber}\n`);

      const {
        repo: { owner, repo },
        issue: { number },
      } = github.context;

      await githubClient.issues.createComment({
        owner,
        repo,
        issue_number: number,
        body: createCommentMessage(draft, deploy),
      });
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

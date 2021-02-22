import * as core from '@actions/core';
import * as github from '@actions/github';
import NetlifyAPI from 'netlify';
import * as path from 'path';

/**
 * Netlify `createSiteDeploy` response.
 *
 * @see https://open-api.netlify.com/#operation/createSiteDeploy
 */
export interface NetlifyDeploy {
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

export const getDeployUrl = (isDraft: boolean, deploy: any): string =>
  isDraft ? deploy.deploy_ssl_url : deploy.ssl_url;

export const createCommentMessage = (isDraft: boolean, deploy: any): string =>
  isDraft
    ? `🚀 Netlify deployed **${deploy.name}** as draft\n\n${getDeployUrl(isDraft, deploy)}`
    : `🎉 Netlify deployed **${deploy.name}** as production\n\n${getDeployUrl(isDraft, deploy)}`;

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
    const dryRun = core.getInput('dry-run') === 'true';

    // Get optional inputs
    const configPath = core.getInput('config-path') || null;
    const draft = core.getInput('draft') === 'true';
    const functionsDir = core.getInput('functions-dir') || null;
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

        process.stdout.write(`${JSON.stringify({ siteDir, fnDir, configPath, draft, functionsDir }, null, 2)}\n`);

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
        // ref,
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
          process.stderr.write('repos.createCommitComment() failed\n');
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
          process.stderr.write('issues.createComment() failed\n');
          process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
          core.setFailed(error.message);
        }
      } else {
        process.stdout.write(`[Dry run] Github pull request comment: "${body}"\n`);
      }
    }
  } catch (error) {
    process.stderr.write(JSON.stringify(error, null, 2));
    core.setFailed(error.message);
  }
}

run();

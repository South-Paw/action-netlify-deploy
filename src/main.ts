import * as core from '@actions/core';
import * as github from '@actions/github';
import * as exec from '@actions/exec';
import * as path from 'path';
import { createCommentMessage, getDeployUrl } from './util';

async function run(): Promise<void> {
  try {
    const isCommit = Object.keys(github.context.payload).includes('head_commit');
    const isPullRequest = Object.keys(github.context.payload).includes('pull_request');
    const isRelease = Object.keys(github.context.payload).includes('release');

    const {
      payload,
      sha,
      issue: { number },
      repo: { owner, repo },
    } = github.context;

    const shaShort = sha.slice(0, 7);
    const deploymentSha = payload.pull_request?.head.sha ?? sha;
    const commitMessage = isCommit ? payload.head_commit?.message : undefined;
    const pullRequestNumber = payload.pull_request?.number;
    const pullRequestTitle = isPullRequest ? payload.pull_request?.title : undefined;
    const releaseTag = isRelease ? payload.release?.tag_name : undefined;
    const releaseTitle = isRelease ? payload.release?.name : undefined;

    // Get required inputs
    const githubToken = core.getInput('github-token', { required: true });
    const netlifyAuthToken = core.getInput('netlify-auth-token', { required: true });
    const siteId = core.getInput('netlify-site-id', { required: true });
    const buildDir = core.getInput('build-dir', { required: true });

    // Get config inputs
    const commentOnCommit = core.getInput('comment-on-commit') === 'true';
    const commentOnPullRequest = core.getInput('comment-on-pull-request') === 'true';
    const githubDeployEnvironment = core.getInput('github-deployment-environment') || undefined;
    const githubDeployDescription = core.getInput('github-deployment-description') || undefined;
    const githubDeployIsTransient = core.getInput('github-deployment-is-transient') === 'true';
    const githubDeployIsProduction = core.getInput('github-deployment-is-production') === 'true';
    const githubDeployReportStatus = core.getInput('github-deployment-should-report-status') === 'true';
    const dryRun = core.getInput('dry-run') === 'true';

    // Get optional inputs
    const draft = core.getInput('draft') === 'true';
    const functionsDir = core.getInput('functions-dir') || undefined;
    let message = core.getInput('message');

    // Create clients
    const octokit = github.getOctokit(githubToken);

    // If there's no explict deploy message input, then make a deploy message from the action's context.
    if (!message) {
      message = `Build [${shaShort}]`;

      if (isCommit) {
        message = `Commit: ${commitMessage} [${shaShort}]`;
      }

      if (isPullRequest) {
        message = `PR: ${pullRequestTitle} [${shaShort}]`;
      }

      if (isRelease) {
        message = `Release: ${releaseTitle} [${releaseTag}]`;
      }
    }

    if (dryRun) {
      process.stdout.write(`Action is running dry - there won't be any outputs from this run.\n`);
    }

    process.stdout.write(`Deploying ${draft ? 'draft ' : ''}to Netlify...\n`);

    let deploy;

    if (!dryRun) {
      try {
        const siteDir = path.resolve(process.cwd(), buildDir);
        const fnDir = functionsDir ? path.resolve(process.cwd(), functionsDir) : undefined;

        const functions = fnDir ? `--functions ${fnDir}` : '';
        const production = draft ? '' : '--prod';
        const auth = `--site ${siteId} --auth ${netlifyAuthToken}`;

        const result = await exec.getExecOutput(
          `netlify deploy ${auth} --build --dir ${siteDir} ${production} ${functions} --message "${message}" --json`,
        );

        const deployment = JSON.parse(result.stdout);

        // eslint-disable-next-line no-console
        console.dir(deployment, { depth: null });

        // const deployment =
        deploy = deployment;
        core.setOutput('preview-name', deploy.site_name);
        core.setOutput('preview-url', deploy.deploy_url);
      } catch (error: any) {
        process.stderr.write('netlify deploy command failed\n ...');
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

    const body = dryRun
      ? createCommentMessage(draft, {
          name: 'dry-run',
          deploy_ssl_url: 'http://example.com',
          ssl_url: 'http://example.com',
        })
      : createCommentMessage(draft, deploy);

    if (isCommit && commentOnCommit) {
      process.stdout.write(`Commenting on commit ${shaShort} (SHA: ${sha})\n`);

      if (!dryRun) {
        try {
          await octokit.rest.repos.createCommitComment({
            owner,
            repo,
            commit_sha: sha,
            body,
          });
        } catch (error: any) {
          process.stderr.write('creating commit comment failed\n');
          process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
          core.setFailed(error.message);
        }
      } else {
        process.stdout.write(`[Dry run] GitHub commit comment: "${body}"\n`);
      }
    }

    if (commentOnPullRequest) {
      process.stdout.write(`Commenting on pull request #${pullRequestNumber}\n`);

      if (!dryRun) {
        try {
          await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: number,
            body,
          });
        } catch (error: any) {
          process.stderr.write('creating pull request comment failed\n');
          process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
          core.setFailed(error.message);
        }
      } else {
        process.stdout.write(`[Dry run] GitHub pull request comment: "${body}"\n`);
      }
    }

    if (githubDeployEnvironment) {
      if (!dryRun) {
        process.stdout.write(`Creating deployment for "${githubDeployEnvironment}"\n`);

        try {
          const deployment = await octokit.rest.repos.createDeployment({
            owner,
            repo,
            ref: deploymentSha,
            auto_merge: false,
            required_contexts: [],
            environment: githubDeployEnvironment,
            description: githubDeployDescription,
            transient_environment: githubDeployIsTransient,
            production_environment: githubDeployIsProduction,
          });

          await octokit.rest.repos.createDeploymentStatus({
            owner,
            repo,
            //@ts-ignore
            deployment_id: deployment.data.id,
            state: 'success',
            environment_url: getDeployUrl(draft, deploy),
          });
        } catch (error: any) {
          process.stderr.write('creating deployment failed\n');
          process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
          core.setFailed(error.message);
        }
      } else {
        process.stdout.write(`[Dry run] GitHub deployment env: "${githubDeployEnvironment}"\n`);
      }

      if (!dryRun) {
        if (githubDeployReportStatus) {
          process.stdout.write(`Creating commit status for SHA: "${deploymentSha}"\n`);

          try {
            await octokit.rest.repos.createCommitStatus({
              sha: deploymentSha,
              owner,
              repo,
              state: 'success',
              context: 'action-netlify-deploy',
              target_url: getDeployUrl(draft, deploy),
              description: 'action-netlify-deploy status',
            });
          } catch (error: any) {
            process.stderr.write('creating commit status failed\n');
            process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
            core.setFailed(error.message);
          }
        }
      } else {
        process.stdout.write(`[Dry run] GitHub commit status "success" on "${deploymentSha}"\n`);
      }
    }
  } catch (error: any) {
    process.stderr.write(JSON.stringify(error, null, 2));
    core.setFailed(error.message);
  }
}

run();

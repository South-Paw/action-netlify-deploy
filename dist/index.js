var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));

// src/index.ts
var core = __toESM(require("@actions/core"));
var github = __toESM(require("@actions/github"));
var exec = __toESM(require("@actions/exec"));
var path = __toESM(require("path"));

// src/util.ts
var getDeployUrl = (isDraft, deploy) => isDraft ? deploy.deploy_ssl_url : deploy.ssl_url;
var createCommentMessage = (isDraft, deploy) => isDraft ? `\u{1F680} [DRAFT] Netlify deployed **${deploy == null ? void 0 : deploy.site_name}** : 

${deploy == null ? void 0 : deploy.deploy_url}` : `\u{1F389} [PROD] Netlify deployed **${deploy == null ? void 0 : deploy.site_name}** : 

${deploy == null ? void 0 : deploy.deploy_url}`;

// src/index.ts
async function run() {
  var _a, _b, _c, _d, _e, _f;
  try {
    const isCommit = Object.keys(github.context.payload).includes("head_commit");
    const isPullRequest = Object.keys(github.context.payload).includes("pull_request");
    const isRelease = Object.keys(github.context.payload).includes("release");
    const {
      payload,
      sha,
      issue: { number },
      repo: { owner, repo }
    } = github.context;
    const shaShort = sha.slice(0, 7);
    const deploymentSha = ((_a = payload.pull_request) == null ? void 0 : _a.head.sha) ?? sha;
    const commitMessage = isCommit ? (_b = payload.head_commit) == null ? void 0 : _b.message : void 0;
    const pullRequestNumber = (_c = payload.pull_request) == null ? void 0 : _c.number;
    const pullRequestTitle = isPullRequest ? (_d = payload.pull_request) == null ? void 0 : _d.title : void 0;
    const releaseTag = isRelease ? (_e = payload.release) == null ? void 0 : _e.tag_name : void 0;
    const releaseTitle = isRelease ? (_f = payload.release) == null ? void 0 : _f.name : void 0;
    const githubToken = core.getInput("github-token", { required: true });
    const netlifyAuthToken = core.getInput("netlify-auth-token", { required: true });
    const siteId = core.getInput("netlify-site-id", { required: true });
    const buildDir = core.getInput("build-dir", { required: true });
    const commentOnCommit = core.getInput("comment-on-commit") === "true";
    const commentOnPullRequest = core.getInput("comment-on-pull-request") === "true";
    const githubDeployEnvironment = core.getInput("github-deployment-environment") || void 0;
    const githubDeployDescription = core.getInput("github-deployment-description") || void 0;
    const githubDeployIsTransient = core.getInput("github-deployment-is-transient") === "true";
    const githubDeployIsProduction = core.getInput("github-deployment-is-production") === "true";
    const githubDeployReportStatus = core.getInput("github-deployment-should-report-status") === "true";
    const dryRun = core.getInput("dry-run") === "true";
    const draft = core.getInput("draft") === "true";
    const functionsDir = core.getInput("functions-dir") || void 0;
    let message = core.getInput("message");
    const octokit = github.getOctokit(githubToken);
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
      process.stdout.write(`Action is running dry - there won't be any outputs from this run.
`);
    }
    process.stdout.write(`Deploying ${draft ? "draft " : ""}to Netlify...
`);
    let deploy;
    if (!dryRun) {
      try {
        const siteDir = path.resolve(process.cwd(), buildDir);
        const fnDir = functionsDir ? path.resolve(process.cwd(), functionsDir) : void 0;
        const functions = fnDir ? `--functions ${fnDir}` : "";
        const production = draft ? "" : "--prod";
        const auth = `--auth ${netlifyAuthToken}`;
        const result = await exec.getExecOutput(`netlify deploy --site ${siteId} ${auth} --dir ${siteDir} ${production} ${functions} --message "${message}" --json`);
        deploy = JSON.parse(result.stdout);
        console.dir(deploy, { depth: null });
        core.setOutput("preview-name", deploy == null ? void 0 : deploy.site_name);
        core.setOutput("preview-url", deploy == null ? void 0 : deploy.deploy_url);
      } catch (error) {
        process.stderr.write("netlify deploy command failed\n ...");
        process.stderr.write(`${JSON.stringify(error, null, 2)}
`);
        core.setFailed(error.message);
      }
      if (!deploy) {
        core.setFailed("Failed to deploy to Netlify!");
        return;
      }
    } else {
      process.stdout.write(`[Dry run] Netlify deploy message: "${message}"
`);
    }
    const body = dryRun ? createCommentMessage(draft, {
      name: "dry-run",
      deploy_ssl_url: "http://example.com",
      ssl_url: "http://example.com"
    }) : createCommentMessage(draft, deploy);
    if (isCommit && commentOnCommit) {
      process.stdout.write(`Commenting on commit ${shaShort} (SHA: ${sha})
`);
      if (!dryRun) {
        try {
          await octokit.rest.repos.createCommitComment({
            owner,
            repo,
            commit_sha: sha,
            body
          });
        } catch (error) {
          process.stderr.write("creating commit comment failed\n");
          process.stderr.write(`${JSON.stringify(error, null, 2)}
`);
          core.setFailed(error.message);
        }
      } else {
        process.stdout.write(`[Dry run] GitHub commit comment: "${body}"
`);
      }
    }
    if (commentOnPullRequest) {
      process.stdout.write(`Commenting on pull request #${pullRequestNumber}
`);
      if (!dryRun) {
        try {
          await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: number,
            body
          });
        } catch (error) {
          process.stderr.write("creating pull request comment failed\n");
          process.stderr.write(`${JSON.stringify(error, null, 2)}
`);
          core.setFailed(error.message);
        }
      } else {
        process.stdout.write(`[Dry run] GitHub pull request comment: "${body}"
`);
      }
    }
    if (githubDeployEnvironment) {
      if (!dryRun) {
        process.stdout.write(`Creating deployment for "${githubDeployEnvironment}"
`);
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
            production_environment: githubDeployIsProduction
          });
          await octokit.rest.repos.createDeploymentStatus({
            owner,
            repo,
            deployment_id: deployment.data.id,
            state: "success",
            environment_url: getDeployUrl(draft, deploy)
          });
        } catch (error) {
          process.stderr.write("creating deployment failed\n");
          process.stderr.write(`${JSON.stringify(error, null, 2)}
`);
          core.setFailed(error.message);
        }
      } else {
        process.stdout.write(`[Dry run] GitHub deployment env: "${githubDeployEnvironment}"
`);
      }
      if (!dryRun) {
        if (githubDeployReportStatus) {
          process.stdout.write(`Creating commit status for SHA: "${deploymentSha}"
`);
          try {
            await octokit.rest.repos.createCommitStatus({
              sha: deploymentSha,
              owner,
              repo,
              state: "success",
              context: "action-netlify-deploy",
              target_url: getDeployUrl(draft, deploy),
              description: "action-netlify-deploy status"
            });
          } catch (error) {
            process.stderr.write("creating commit status failed\n");
            process.stderr.write(`${JSON.stringify(error, null, 2)}
`);
            core.setFailed(error.message);
          }
        }
      } else {
        process.stdout.write(`[Dry run] GitHub commit status "success" on "${deploymentSha}"
`);
      }
    }
  } catch (error) {
    process.stderr.write(JSON.stringify(error, null, 2));
    core.setFailed(error.message);
  }
}
run();

# action-netlify-deploy

🙌 Netlify deployments via GitHub actions

![CI](https://github.com/South-Paw/action-netlify-deploy/workflows/CI/badge.svg)
[![Dependencies](https://david-dm.org/South-Paw/action-netlify-deploy/status.svg)](https://david-dm.org/South-Paw/action-netlify-deploy)
[![Dev Dependencies](https://david-dm.org/South-Paw/action-netlify-deploy/dev-status.svg)](https://david-dm.org/South-Paw/action-netlify-deploy?type=dev)

## About

A Github action that deploys a build directory to Netlify. It can be configured to comment on the commit or PR with the deploy URL or deploy with GitHub environments, deploy draft builds, deploy Netlify functions and use custom Netlify configs.

## Getting started

There are 4 required inputs for the action

- `github-token` which is usually `${{ secrets.GITHUB_TOKEN }}`
- `netlify-auth-token` this is a [personal access token](https://app.netlify.com/user/applications#personal-access-tokens) created from your Netlify account
  - ⚠️ This should be stored as a [Github secret](https://help.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets) in your repo
- `netlify-site-id` this is the API ID of your Netlify site
  - To find this, go to your site's settings and in the "site information" copy the `API ID` field
- `build-dir` this is where your site build outputs to relative to the root of your projects folder

See the [action.yml](./action.yml) for other action inputs and their descriptions

## Usage

Here are some ideas of how to configure this action in different workflows...

- [Deploying drafts on each commit and publishing on push to master](https://github.com/South-Paw/action-netlify-deploy#deploying-drafts-on-each-commit-and-publishing-on-push-to-master)
- [Deploying drafts of pull requests and publishing on push to master](https://github.com/South-Paw/action-netlify-deploy#deploying-drafts-of-pull-requests-and-publishing-on-push-to-master)
- [Deploying drafts of pull requests and publish on release created](https://github.com/South-Paw/action-netlify-deploy#deploying-drafts-of-pull-requests-and-publish-on-release-created)

### Deploying drafts on each commit and publishing on push to master

```yaml
name: CI

on: [push]

jobs:
  # This job will:
  #   * deploy a draft every time there is a commit that is not on master branch
  #   * comment on that commit with the deploy URL
  deployCommitDraft:
    name: Deploy draft to Netlify
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref != 'refs/heads/master'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v1

      # ... your other build steps to produce a build directory
      # e.g. `npm run build` for create-react-app

      - name: Deploy draft to Netlify
        uses: South-Paw/action-netlify-deploy@v1.0.4
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          netlify-site-id: ${{ secrets.NETLIFY_SITE_ID }}
          build-dir: './build'
          draft: true
          comment-on-commit: true

  # This job will:
  #   * deploy a production build every time there is a push only on the master branch
  #   * comment that commit with the deploy URL
  publishMasterCommit:
    name: Publish to Netlify
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/master'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v1

      # ... your other build steps to produce a build directory
      # e.g. `npm run build` for create-react-app

      - name: Deploy production to Netlify
        uses: South-Paw/action-netlify-deploy@v1.0.4
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          netlify-site-id: ${{ secrets.NETLIFY_SITE_ID }}
          build-dir: './build'
          comment-on-commit: true
```

### Deploying drafts of pull requests and publishing on push to master

```yaml
name: CI

on:
  push:
  pull_request:
    types:
      - opened
      - synchronize

jobs:
  # This job will:
  #   * deploy a draft every time there is a pull request created or synchronized that is not on master branch
  #   * comment on that pull request with the deploy URL
  deployPRDraft:
    name: Deploy draft to Netlify
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request' && github.ref != 'refs/heads/master'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v1

      # ... your other build steps to produce a build directory
      # e.g. `npm run build` for create-react-app

      - name: Deploy draft to Netlify
        uses: South-Paw/action-netlify-deploy@v1.0.4
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          netlify-site-id: ${{ secrets.NETLIFY_SITE_ID }}
          build-dir: './build'
          draft: true
          comment-on-pull-request: true

  # This job will:
  #   * deploy a production build every time there is a push on the master branch
  #   * comment that commit with the deploy URL
  publishMasterCommit:
    name: Publish to Netlify
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/master'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v1

      # ... your other build steps to produce a build directory
      # e.g. `npm run build` for create-react-app

      - name: Deploy production to Netlify
        uses: South-Paw/action-netlify-deploy@v1.0.4
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          netlify-site-id: ${{ secrets.NETLIFY_SITE_ID }}
          build-dir: './build'
          comment-on-commit: true
```

### Deploying drafts of pull requests and publish on release created

```yaml
name: CI

on:
  pull_request:
    types:
      - opened
      - synchronize
  release:
    types:
      - created

jobs:
  # This job will:
  #   * deploy a draft every time there is a pull request created or synchronized that is not on master branch
  #   * comment on that pull request with the deploy URL
  deployPRDraft:
    name: Deploy draft to Netlify
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request' && github.ref != 'refs/heads/master'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v1

      # ... your other build steps to produce a build directory
      # e.g. `npm run build` for create-react-app

      - name: Deploy draft to Netlify
        uses: South-Paw/action-netlify-deploy@v1.0.4
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          netlify-site-id: ${{ secrets.NETLIFY_SITE_ID }}
          build-dir: './build'
          draft: true
          comment-on-pull-request: true

  # This job will:
  #   * deploy a production build every time there is a release created on the master branch
  #   * comment that commit with the deploy URL
  publishOnMasterRelease:
    name: Publish release to Netlify
    runs-on: ubuntu-latest
    if: github.event_name == 'release' && github.event.action == 'created'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v1

      # ... your other build steps to produce a build directory
      # e.g. `npm run build` for create-react-app

      - name: Deploy production to Netlify
        uses: South-Paw/action-netlify-deploy@v1.0.4
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          netlify-site-id: ${{ secrets.NETLIFY_SITE_ID }}
          build-dir: './build'
```

## Issues and Bugs

If you find any, please report them [here](https://github.com/South-Paw/action-report-coverage/issues) so they can be squashed.

## Development and Contributing

Download the repo and then install dependencies with `npm`.

```bash
# build the action to `./dist`
npm run build

# clean the `./dist` dir
npm run clean

# lint project
npm run lint

# run tests
npm run test
```

Contributions and improvements are always welcome 👍

## License

MIT, see the [LICENSE](./LICENSE) file.

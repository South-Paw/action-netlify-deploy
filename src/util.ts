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

export const createCommentMessage = (isDraft: boolean, deploy: NetlifyDeploy) =>
  isDraft
    ? `🚀 Netlify deployed **${deploy.name}** as draft\n\n${deploy.deploy_ssl_url}`
    : `🎉 Netlify deployed **${deploy.name}** as production\n\n${deploy.ssl_url}`;

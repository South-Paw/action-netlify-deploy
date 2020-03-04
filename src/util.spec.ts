import { createCommentMessage, NetlifyDeploy, createDeployMessage } from './util';

const mockDeploy: NetlifyDeploy = {
  id: 'string',
  site_id: 'string',
  user_id: 'string',
  build_id: 'string',
  state: 'string',
  name: 'string',
  url: 'string',
  ssl_url: 'string',
  admin_url: 'string',
  deploy_url: 'string',
  deploy_ssl_url: 'string',
  screenshot_url: 'string',
  review_id: 0,
  draft: true,
  required: [],
  required_functions: [],
  error_message: 'string',
  branch: 'string',
  commit_ref: 'string',
  commit_url: 'string',
  skipped: false,
  created_at: 'string',
  updated_at: 'string',
  published_at: 'string',
  title: 'string',
  context: 'string',
  locked: false,
  review_url: 'string',
  site_capabilities: {},
};

describe('createCommentMessage', () => {
  it('should return a draft string when `isDraft` is true', () => {
    const string = createCommentMessage(true, { ...mockDeploy, deploy_ssl_url: 'https://example.com' });
    expect(string).toContain('https://example.com');
  });

  it('should return a published string when `isDraft` is false', () => {
    const string = createCommentMessage(false, { ...mockDeploy, name: 'Testing name', ssl_url: 'https://example.com' });
    expect(string).toContain('Testing name');
    expect(string).toContain('https://example.com');
  });
});

describe('createDeployMessage', () => {
  it('should return undefined if there is no commitMessage or pullRequestTitle', () => {
    const string = createDeployMessage('123', undefined, undefined);
    expect(string).toBeUndefined();
  });

  it('should return a commit string if there is a commitMessage', () => {
    const string = createDeployMessage('123', 'message', undefined);
    expect(string).toContain('Commit:');
    expect(string).toContain('message');
    expect(string).toContain('[123]');
  });

  it('should return a pr string if there is a pullRequestTitle', () => {
    const string = createDeployMessage('123', undefined, 'message');
    expect(string).toContain('PR:');
    expect(string).toContain('message');
    expect(string).toContain('[123]');
  });
});

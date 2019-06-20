import { NetlifyCmsCore as CMS } from 'netlify-cms-core';
import { GitHubBackend } from 'netlify-cms-backend-github';
import { GitLabBackend } from 'netlify-cms-backend-gitlab';
import { GitGatewayBackend } from 'netlify-cms-backend-git-gateway';
import { BitbucketBackend } from 'netlify-cms-backend-bitbucket';
import { WebDAVBackend } from 'netlify-cms-backend-webdav';
import { TestBackend } from 'netlify-cms-backend-test';

CMS.registerBackend('git-gateway', GitGatewayBackend);
CMS.registerBackend('github', GitHubBackend);
CMS.registerBackend('gitlab', GitLabBackend);
CMS.registerBackend('bitbucket', BitbucketBackend);
CMS.registerBackend('webdav', WebDAVBackend);
CMS.registerBackend('test-repo', TestBackend);

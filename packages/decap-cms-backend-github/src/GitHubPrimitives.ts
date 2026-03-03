import type { BackendPrimitives, FileDiff, GitPR } from 'decap-cms-lib-util';
import type API from './API';

export default class GitHubPrimitives implements BackendPrimitives {
  api: API;

  constructor(api: API) {
    this.api = api;
  }

  async branchExists(branch: string): Promise<boolean> {
    try {
      await this.api.getBranch(branch);
      return true;
    } catch (e) {
      return false;
    }
  }

  async getBranchSHA(branch: string): Promise<string> {
    const branchData = await this.api.getBranch(branch);
    return branchData.commit.sha;
  }

  async createBranch(branch: string, fromRef: string): Promise<void> {
    await this.api.createBranch(branch, fromRef);
  }

  async diffBranches(head: string, base: string): Promise<FileDiff[]> {
    const result = await this.api.getDifferences(base, head);
    const files = result.files || [];
    return files.map(file => {
      const diff: FileDiff = {
        path: file.filename,
        newFile: file.status === 'added',
        deleted: file.status === 'removed',
        renamed: file.status === 'renamed',
      };
      if (file.status === 'renamed' && file.previous_filename) {
        diff.oldPath = file.previous_filename;
      }
      return diff;
    });
  }

  async createPR(head: string, base: string, title: string, body: string): Promise<GitPR> {
    // The API's createPR takes (title, head) and internally uses this.branch as base
    // and DEFAULT_PR_BODY as body.
    const result = await this.api.createPR(title, head);
    return {
      number: result.number,
      head: result.head.sha,
      labels: (result.labels || []).map(l => l.name),
    };
  }

  async mergePR(pr: GitPR): Promise<void> {
    // The API's mergePR expects an object shaped like GitHubPull:
    // { number, head: { sha }, labels: [{ name }], ... }
    const ghPull = {
      number: pr.number,
      head: { sha: pr.head },
      labels: (pr.labels || []).map(name => ({ name })),
    };
    await this.api.mergePR(ghPull as any);
  }

  async commitToBranch(
    files: { path: string; raw: string | null; sha?: string | null }[],
    branch: string,
    message: string,
  ): Promise<string> {
    // Upload blobs for files that have content (non-null raw)
    const filesToUpload = files.filter(f => f.raw !== null);
    await Promise.all(filesToUpload.map(file => this.api.uploadBlob(file)));

    // Get the current branch head
    const branchData = await this.api.getBranch(branch);

    // Build the tree files with sha set from blob upload (or null for deletions)
    const treeFiles = files.map(file => ({
      path: file.path,
      sha: file.raw !== null ? (file.sha as string) : null,
    }));

    // Create the updated tree
    const changeTree = await this.api.updateTree(branchData.commit.sha, treeFiles);

    // Create the commit
    const commitResult = await this.api.commit(message, changeTree);

    // Update the branch ref
    await this.api.patchBranch(branch, commitResult.sha);

    return commitResult.sha;
  }

  async rebaseBranch(branch: string, onto: string): Promise<void> {
    // The API's rebaseBranch internally uses this.branch as the base ("onto")
    await this.api.rebaseBranch(branch);
  }
}

import type { SupportDirectoryResponse } from '@vbyg/contracts';

import {
  normalizeSupportCacheRevision,
  type StagedSupportDirectoryCache,
} from './support-cache';

export type SupportRequestAuthority = number;

type CacheStager = (data: SupportDirectoryResponse) => Promise<StagedSupportDirectoryCache>;
type CacheCommitter = (
  candidate: StagedSupportDirectoryCache,
  isAuthoritative: () => boolean,
) => Promise<boolean>;

export class SupportDirectoryCoordinator {
  private requestGeneration = 0;
  private mutationGeneration = 0;
  private mutationTail: Promise<void> = Promise.resolve();

  beginRequest(): SupportRequestAuthority {
    this.requestGeneration += 1;
    this.mutationGeneration += 1;
    return this.requestGeneration;
  }

  currentRequestAuthority(): SupportRequestAuthority {
    return this.requestGeneration;
  }

  isRequestAuthoritative(authority: SupportRequestAuthority): boolean {
    return authority === this.requestGeneration;
  }

  revokeRequest(authority: SupportRequestAuthority): void {
    if (this.isRequestAuthoritative(authority)) {
      this.requestGeneration += 1;
      this.mutationGeneration += 1;
    }
  }

  async saveForRequest(
    authority: SupportRequestAuthority,
    data: SupportDirectoryResponse,
    stage: CacheStager,
    commit: CacheCommitter,
  ): Promise<boolean> {
    if (!this.isRequestAuthoritative(authority)) return false;
    const mutation = this.claimMutation();
    const candidate = await stage(data);
    return this.enqueueMutation(async () => {
      if (!this.isRequestAuthoritative(authority) || mutation !== this.mutationGeneration) {
        return false;
      }
      return commit(
        candidate,
        () => this.isRequestAuthoritative(authority) && mutation === this.mutationGeneration,
      );
    });
  }

  async saveManual(
    authority: SupportRequestAuthority,
    responseRevision: string,
    data: SupportDirectoryResponse,
    stage: CacheStager,
    commit: CacheCommitter,
  ): Promise<boolean> {
    const normalizedResponseRevision = normalizeSupportCacheRevision(responseRevision);
    if (
      !this.isRequestAuthoritative(authority)
      || !normalizedResponseRevision
      || normalizeSupportCacheRevision(data.fetchedAt) !== normalizedResponseRevision
    ) return false;
    const mutation = this.claimMutation();
    const candidate = await stage(data);
    return this.enqueueMutation(async () => {
      if (
        !this.isRequestAuthoritative(authority)
        || mutation !== this.mutationGeneration
        || candidate.responseRevision !== normalizedResponseRevision
      ) return false;
      return commit(
        candidate,
        () => this.isRequestAuthoritative(authority) && mutation === this.mutationGeneration,
      );
    });
  }

  readAtMutationBoundary<T>(reader: () => Promise<T>): Promise<T> {
    return this.enqueueMutation(reader);
  }

  whenIdle(): Promise<void> {
    return this.mutationTail;
  }

  private claimMutation(): number {
    this.mutationGeneration += 1;
    return this.mutationGeneration;
  }

  private enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationTail.then(operation, operation);
    this.mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

export const supportDirectoryCoordinator = new SupportDirectoryCoordinator();

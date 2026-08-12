import type { SupportDirectoryResponse } from '@vbyg/contracts';

export type SupportRequestAuthority = number;

type CacheWriter = (data: SupportDirectoryResponse) => Promise<void>;

export class SupportDirectoryCoordinator {
  private requestGeneration = 0;
  private mutationGeneration = 0;
  private mutationTail: Promise<void> = Promise.resolve();

  beginRequest(): SupportRequestAuthority {
    this.requestGeneration += 1;
    return this.requestGeneration;
  }

  isRequestAuthoritative(authority: SupportRequestAuthority): boolean {
    return authority === this.requestGeneration;
  }

  revokeRequest(authority: SupportRequestAuthority): void {
    if (this.isRequestAuthoritative(authority)) this.requestGeneration += 1;
  }

  async saveForRequest(
    authority: SupportRequestAuthority,
    data: SupportDirectoryResponse,
    writer: CacheWriter,
  ): Promise<boolean> {
    if (!this.isRequestAuthoritative(authority)) return false;
    const mutation = this.claimMutation();
    return this.enqueueMutation(async () => {
      if (!this.isRequestAuthoritative(authority) || mutation !== this.mutationGeneration) {
        return false;
      }
      try {
        await writer(data);
      } catch (error) {
        if (!this.isRequestAuthoritative(authority) || mutation !== this.mutationGeneration) {
          return false;
        }
        throw error;
      }
      return this.isRequestAuthoritative(authority) && mutation === this.mutationGeneration;
    });
  }

  async saveManual(
    data: SupportDirectoryResponse,
    writer: CacheWriter,
  ): Promise<boolean> {
    const mutation = this.claimMutation();
    return this.enqueueMutation(async () => {
      if (mutation !== this.mutationGeneration) return false;
      try {
        await writer(data);
      } catch (error) {
        if (mutation !== this.mutationGeneration) return false;
        throw error;
      }
      return mutation === this.mutationGeneration;
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

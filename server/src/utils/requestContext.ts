import { AsyncLocalStorage } from 'async_hooks';

/** Кто выполняет текущий запрос — нужно журналу изменений, который живёт в слое Prisma. */
export interface RequestContext {
  requestId: string;
  userId?: string;
  userName?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export const currentContext = (): RequestContext | undefined => requestContext.getStore();

import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { randomUUID } from 'node:crypto';

import { registerAnalysisRoute } from './modules/analysis/analysis.route.js';
import { registerAlertsRoutes } from './modules/alerts/alerts.route.js';
import { emptyAlertsRepository, type AlertsRepository } from './modules/alerts/alerts.repository.js';
import { registerHealthRoute, type DatabaseCheck } from './modules/health/health.route.js';
import { registerNewsRoutes } from './modules/news/news.route.js';
import { emptyNewsRepository, type NewsRepository } from './modules/news/news.repository.js';
import { registerReportsRoutes } from './modules/reports/reports.route.js';
import {
  unavailableReportsRepository,
  type ReportsRepository,
} from './modules/reports/reports.repository.js';
import { registerShareTokenRoutes } from './modules/shares/share-token.route.js';
import { registerSupportRoutes } from './modules/support/support.route.js';
import {
  emptySupportRepository,
  type SupportRepository,
} from './modules/support/support.repository.js';

export interface BuildAppOptions {
  corsOrigins: string[];
  databaseCheck: DatabaseCheck;
  logger?: FastifyServerOptions['logger'];
  alertsRepository?: AlertsRepository;
  newsRepository?: NewsRepository;
  reportsRepository?: ReportsRepository;
  supportRepository?: SupportRepository;
  reportSecuritySecret?: string;
}

function createPrivacySafeLogger(logger: BuildAppOptions['logger']): FastifyServerOptions['logger'] {
  if (!logger) return false;
  const options = logger === true ? {} : logger;
  return {
    ...options,
    serializers: {
      ...options.serializers,
      req(request) {
        return {
          method: request.method,
          url: request.url.split('?')[0],
          remoteAddress: request.ip,
        };
      },
    },
  };
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    ajv: { customOptions: { removeAdditional: false } },
    genReqId: () => randomUUID(),
    logger: createPrivacySafeLogger(options.logger),
    // Credentials can arrive in arbitrary client headers. Never let a caller
    // choose the identifier Fastify copies into logs and public error bodies.
    requestIdHeader: false,
    trustProxy: false,
  });
  await app.register(cors, { origin: options.corsOrigins });
  await registerHealthRoute(app, options.databaseCheck);
  await registerAnalysisRoute(app);
  await registerAlertsRoutes(app, options.alertsRepository ?? emptyAlertsRepository);
  await registerNewsRoutes(app, options.newsRepository ?? emptyNewsRepository);
  await registerSupportRoutes(app, options.supportRepository ?? emptySupportRepository);
  await registerReportsRoutes(
    app,
    options.reportsRepository ?? unavailableReportsRepository,
    options.reportSecuritySecret ?? 'dGVzdC1vbmx5LXJlcG9ydC1zZWN1cml0eS1zZWNyZXQtMzItYnl0ZXM',
  );
  await registerShareTokenRoutes(
    app,
    options.reportSecuritySecret ?? 'dGVzdC1vbmx5LXJlcG9ydC1zZWN1cml0eS1zZWNyZXQtMzItYnl0ZXM',
  );
  app.setErrorHandler((error, request, reply) => {
    if (typeof error === 'object' && error !== null && 'validation' in error && error.validation) {
      request.log.warn('Request validation failed');
      void reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The submitted information is incomplete or invalid.',
          requestId: request.id,
        },
      });
      return;
    }
    request.log.error({ err: error }, 'Request failed');
    void reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'The service could not complete the request.', requestId: request.id },
    });
  });
  return app;
}

import { Prisma } from '@prisma/client';
import { currentContext } from '../utils/requestContext';
import { logger } from '../utils/logger';

/**
 * Журнал изменений денег: каждое создание, изменение и удаление в кассе, капитале, долгах,
 * сделках, позициях записей и зарплатах пишется в таблицу AuditLog и в лог сервера —
 * кто, когда, что было и что стало. В интерфейсе журнал не показывается.
 *
 * Запись журнала идёт отдельным запросом после успешной операции. Если операция была частью
 * транзакции, которая потом откатилась, в журнале останется запись о попытке — для журнала
 * это допустимо (лишняя строка лучше пропущенной).
 */
const AUDITED_MODELS = new Set<string>([
  'CashTransaction', 'CapitalTransaction', 'Debt', 'DebtPayment', 'Deal', 'RecordItem',
  'EmployeeSalaryPayment', 'SalaryAdjustment', 'FounderSalary', 'SalaryRate', 'MonthlyRevenue',
  'StockMovement', 'VdfOrder', 'VdfOrderPayment',
]);

const WRITE_OPS = new Set([
  'create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn',
  'upsert', 'delete', 'deleteMany',
]);

type Delegate = {
  findUnique: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<unknown[]>;
};

const delegateName = (model: string) => model.charAt(0).toLowerCase() + model.slice(1);

const actionOf = (operation: string) =>
  operation.startsWith('create') ? 'create' : operation.startsWith('delete') ? 'delete' : 'update';

const entityIdOf = (row: unknown) =>
  row && typeof row === 'object' && 'id' in row ? String((row as { id: unknown }).id) : null;

/** Decimal и Date → JSON-совместимый вид */
const toJson = (value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull =>
  value == null ? Prisma.DbNull : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);

/** Клиент без расширений: из него читаем «как было» и пишем сам журнал */
type AuditBase = {
  auditLog: { create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown> };
};

export function auditExtension(base: AuditBase) {
  const write = (entry: { action: string; model: string; entityId: string | null; before?: unknown; after?: unknown }) => {
    const ctx = currentContext();
    logger.info('audit', { action: entry.action, model: entry.model, entityId: entry.entityId });
    base.auditLog.create({
      data: {
        userId: ctx?.userId ?? null,
        userName: ctx?.userName ?? null,
        action: entry.action,
        model: entry.model,
        entityId: entry.entityId,
        before: toJson(entry.before),
        after: toJson(entry.after),
      },
    }).catch((err: unknown) => logger.error('Не удалось записать журнал изменений', { err }));
  };

  return Prisma.defineExtension({
    name: 'audit',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!AUDITED_MODELS.has(model) || !WRITE_OPS.has(operation)) return query(args);

          const delegate = (base as unknown as Record<string, Delegate>)[delegateName(model)];
          const where = (args as { where?: unknown }).where;
          let before: unknown;
          if (where && (operation === 'update' || operation === 'delete' || operation === 'upsert')) {
            before = await delegate.findUnique({ where }).catch(() => undefined);
          } else if (operation === 'updateMany' || operation === 'updateManyAndReturn' || operation === 'deleteMany') {
            before = await delegate.findMany({ where }).catch(() => undefined);
          }

          const result = await query(args);

          const action = actionOf(operation);
          if (Array.isArray(before)) {
            // Массовые операции: по строке журнала на каждую затронутую запись
            if (before.length === 0) return result;
            for (const row of before) {
              write({ action, model, entityId: entityIdOf(row), before: row, after: action === 'delete' ? undefined : { bulk: (args as { data?: unknown }).data } });
            }
          } else if (operation === 'createMany') {
            write({ action, model, entityId: null, after: (args as { data?: unknown }).data });
          } else {
            write({
              action: operation === 'upsert' && !before ? 'create' : action,
              model,
              entityId: entityIdOf(result) ?? entityIdOf(before),
              before,
              after: action === 'delete' ? undefined : result,
            });
          }
          return result;
        },
      },
    },
  });
}

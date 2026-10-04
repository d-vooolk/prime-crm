import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { baseSalaryFor, effectiveSalaryMonth, setBaseSalary } from './salaryRates';
import { roleLevel, ROLES } from '../utils/roles';

// Создателя нельзя уволить или удалить: без него некому управлять системой
const UNDISMISSABLE_ROLE = ROLES.CREATOR;

export interface ServicemanInput {
  name?: string;
  position?: string | null;
  role?: string | null;
  email?: string | null;
  password?: string;
  photoUrl?: string | null;
  isReceptionist?: boolean;
  isPerformer?: boolean;
  birthday?: string | null;
  profitPercent?: number;
  baseSalary?: number;
}

/** Сотрудник для клиента: вместо истории окладов — оклад текущего расчётного периода */
async function withBaseSalary(id: string) {
  const s = await prisma.serviceman.findUniqueOrThrow({ where: { id }, include: { salaryRates: true } });
  const { salaryRates, ...rest } = s;
  return { ...rest, baseSalary: baseSalaryFor(salaryRates, effectiveSalaryMonth()) };
}

/**
 * ФИО сотрудника уникально: по нему считается зарплата и на него ссылается вся история.
 * Тёзку нельзя создать, даже если существующий уволен.
 */
async function assertNameIsFree(name: string, excludeId?: string) {
  const existing = await prisma.serviceman.findUnique({ where: { name } });
  if (!existing || existing.id === excludeId) return;
  if (existing.isDismissed) {
    throw new AppError(
      `Сотрудник «${name}» уже есть в списке уволенных. Восстановите его в разделе «Уволенные» — вся история по зарплате сохранится.`,
      409,
    );
  }
  throw new AppError(`Сотрудник «${name}» уже есть в списке сотрудников. Укажите другое ФИО.`, 409);
}

/** Менять можно только сотрудников своего уровня и ниже, и назначать роль не выше своей */
function assertCanManage(myLevel: number, targetRole: string | null | undefined, action: string) {
  if (myLevel !== 0 && roleLevel(targetRole) < myLevel) {
    throw new AppError(`Недостаточно прав для ${action} этого сотрудника`, 403);
  }
}
function assertCanAssignRole(myLevel: number, role: string | null | undefined) {
  if (role !== undefined && myLevel !== 0 && roleLevel(role) < myLevel) {
    throw new AppError('Нельзя назначить роль выше вашего уровня', 403);
  }
}

async function getOrThrow(id: string) {
  const s = await prisma.serviceman.findUnique({ where: { id } });
  if (!s) throw new AppError('Сотрудник не найден', 404);
  return s;
}

export const servicemenService = {
  async list(includeDismissed: boolean) {
    const servicemen = await prisma.serviceman.findMany({
      where: includeDismissed ? undefined : { isDismissed: false },
      orderBy: { name: 'asc' },
      include: { salaryRates: true },
    });
    const period = effectiveSalaryMonth();
    return servicemen.map(({ salaryRates, ...s }) => ({ ...s, baseSalary: baseSalaryFor(salaryRates, period) }));
  },

  async create(input: ServicemanInput & { name: string }, myLevel: number) {
    assertCanAssignRole(myLevel, input.role);
    await assertNameIsFree(input.name);
    const s = await prisma.serviceman.create({
      data: {
        name: input.name,
        position: input.position ?? null,
        role: input.role ?? null,
        email: input.email ?? null,
        password: input.password ? await bcrypt.hash(input.password, 10) : undefined,
        photoUrl: input.photoUrl ?? null,
        isReceptionist: !!input.isReceptionist,
        isPerformer: !!input.isPerformer,
        birthday: input.birthday ? new Date(input.birthday) : undefined,
        ...(input.profitPercent !== undefined && { profitPercent: input.profitPercent }),
      },
    });
    if (input.baseSalary !== undefined) await setBaseSalary(s.id, input.baseSalary);
    return withBaseSalary(s.id);
  },

  async update(id: string, input: ServicemanInput, myLevel: number) {
    const existing = await getOrThrow(id);
    assertCanManage(myLevel, existing.role, 'редактирования');
    assertCanAssignRole(myLevel, input.role);
    const renamed = input.name !== undefined && input.name !== existing.name;
    if (renamed) await assertNameIsFree(input.name!, id);

    const password = input.password ? await bcrypt.hash(input.password, 10) : undefined;
    await prisma.$transaction(async (tx) => {
      // История по ФИО (записи, позиции, выплаты, корректировки, ЗП учредителей) переименуется
      // каскадом внешних ключей. Делёж работы между мастерами хранится в JSON, а «изыматель»
      // в кассе и капитале — свободный текст: их переносим здесь же, в той же транзакции
      await tx.serviceman.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.position !== undefined && { position: input.position }),
          ...(input.role !== undefined && { role: input.role }),
          ...(input.email !== undefined && { email: input.email }),
          ...(password !== undefined && { password }),
          ...(input.photoUrl !== undefined && { photoUrl: input.photoUrl }),
          ...(input.isReceptionist !== undefined && { isReceptionist: input.isReceptionist }),
          ...(input.isPerformer !== undefined && { isPerformer: input.isPerformer }),
          ...(input.profitPercent !== undefined && { profitPercent: input.profitPercent }),
          ...(input.birthday !== undefined && { birthday: input.birthday ? new Date(input.birthday) : null }),
          // Снятый с приёмщиков не может оставаться приёмщиком по умолчанию
          ...(input.isReceptionist === false && { isDefault: false }),
        },
      });
      if (renamed) {
        const from = existing.name;
        const to = input.name!;
        await tx.$executeRaw`
          UPDATE "RecordItem"
          SET "servicemanSplit" = (
            SELECT jsonb_agg(CASE WHEN e->>'name' = ${from} THEN jsonb_set(e, '{name}', to_jsonb(${to}::text)) ELSE e END)
            FROM jsonb_array_elements("servicemanSplit") e
          )
          WHERE jsonb_typeof("servicemanSplit") = 'array'
            AND "servicemanSplit" @> jsonb_build_array(jsonb_build_object('name', ${from}::text))
        `;
        await tx.cashTransaction.updateMany({ where: { person: from }, data: { person: to } });
        await tx.capitalTransaction.updateMany({ where: { person: from }, data: { person: to } });
      }
    });
    if (input.baseSalary !== undefined) await setBaseSalary(id, input.baseSalary);
    return withBaseSalary(id);
  },

  async dismiss(id: string, myLevel: number) {
    const existing = await getOrThrow(id);
    assertCanManage(myLevel, existing.role, 'увольнения');
    if (existing.role === UNDISMISSABLE_ROLE) throw new AppError('Создателя нельзя уволить', 403);
    await prisma.serviceman.update({ where: { id }, data: { isDismissed: true, isDefault: false } });
    return withBaseSalary(id);
  },

  // Восстановление возвращает ту же запись, а не создаёт новую — вся история остаётся при ней
  async restore(id: string, myLevel: number) {
    const existing = await getOrThrow(id);
    assertCanManage(myLevel, existing.role, 'восстановления');
    await prisma.serviceman.update({ where: { id }, data: { isDismissed: false } });
    return withBaseSalary(id);
  },

  async setDefaultReceptionist(id: string) {
    const target = await getOrThrow(id);
    if (!target.isReceptionist) throw new AppError('Сотрудник не отмечен как мастер приёмщик', 400);
    await prisma.$transaction([
      prisma.serviceman.updateMany({ where: { isReceptionist: true }, data: { isDefault: false } }),
      prisma.serviceman.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return withBaseSalary(id);
  },

  /**
   * Удалить можно только сотрудника без истории. Если на него ссылаются записи или зарплата,
   * база не даст удалить (внешний ключ) — тогда его нужно уволить.
   */
  async delete(id: string, myLevel: number) {
    const existing = await getOrThrow(id);
    assertCanManage(myLevel, existing.role, 'удаления');
    if (existing.role === UNDISMISSABLE_ROLE) throw new AppError('Создателя нельзя удалить', 403);
    try {
      await prisma.serviceman.delete({ where: { id } });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2003') {
        throw new AppError('У сотрудника есть записи или выплаты — его можно только уволить, история сохранится', 409);
      }
      throw e;
    }
  },

  async todayBirthdays() {
    const now = new Date();
    const all = await prisma.serviceman.findMany({
      where: { isDismissed: false, birthday: { not: null } },
      select: { id: true, name: true, birthday: true, position: true },
    });
    return all.filter(s => s.birthday!.getMonth() === now.getMonth() && s.birthday!.getDate() === now.getDate());
  },
};

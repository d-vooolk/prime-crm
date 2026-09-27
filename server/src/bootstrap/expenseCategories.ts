import { prisma } from '../prisma/client';
import { DEFAULT_EXPENSE_CATEGORIES } from '../services/expenses.service';

/**
 * Стандартные категории затрат для расходов кассы.
 *
 * Засеваются только в пустую таблицу: если пользователь удалил или переименовал
 * какие-то категории, при следующем старте они не вернутся.
 */
export async function seedExpenseCategoriesIfEmpty() {
  try {
    if (await prisma.expenseCategory.count() > 0) return;
    const { count } = await prisma.expenseCategory.createMany({
      data: DEFAULT_EXPENSE_CATEGORIES.map((name, i) => ({ name, sortOrder: i })),
      skipDuplicates: true,
    });
    console.log(`[expense-categories] добавлено стандартных категорий: ${count}`); // eslint-disable-line no-console
  } catch (e) {
    console.log(`[expense-categories] ошибка: ${(e as Error).message}`); // eslint-disable-line no-console
  }
}

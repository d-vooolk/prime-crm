import dayjs, { Dayjs } from 'dayjs';
import type { ServicemanPayload } from '@/api/services.api';
import type { Serviceman } from '@/types';

/** День рождения для списка сотрудников: дата и признак «сегодня» (год не важен) */
export function birthdayInfo(birthday: string | null | undefined, today: Dayjs = dayjs()) {
  if (!birthday) return null;
  const bd = dayjs(birthday);
  const isToday = bd.month() === today.month() && bd.date() === today.date();
  return { text: bd.format('DD.MM.YYYY'), isToday };
}

/** Разделитель тысяч для InputNumber: 12500 → «12 500» */
export const formatThousands = (v: string | number | undefined) =>
  `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export interface ServicemanFormValues {
  name: string;
  position?: string;
  role?: string;
  email?: string;
  password?: string;
  isReceptionist?: boolean;
  isPerformer?: boolean;
  birthday?: Dayjs | null;
  profitPercent?: number | null;
  baseSalary?: number | null;
}

/**
 * Данные формы сотрудника → тело запроса. Пароль отправляем только заполненным:
 * сервер его не отдаёт, и пустое поле при редактировании значит «не менять».
 */
export function buildServicemanPayload(values: ServicemanFormValues): ServicemanPayload & { name: string } {
  return {
    name: values.name,
    position: values.position,
    role: values.role || undefined,
    email: values.email,
    password: values.password || undefined,
    isReceptionist: !!values.isReceptionist,
    isPerformer: !!values.isPerformer,
    birthday: values.birthday ? values.birthday.toISOString() : null,
    profitPercent: values.profitPercent ?? 0,
    baseSalary: values.baseSalary ?? 0,
  };
}

/** Значения формы при редактировании: пароль всегда пустой */
export function servicemanToFormValues(row: Serviceman): ServicemanFormValues {
  return {
    name: row.name,
    position: row.position,
    role: row.role,
    email: row.email,
    password: '',
    profitPercent: row.profitPercent ?? 0,
    baseSalary: row.baseSalary ?? 0,
    isReceptionist: row.isReceptionist,
    isPerformer: !!row.isPerformer,
    birthday: row.birthday ? dayjs(row.birthday) : null,
  };
}

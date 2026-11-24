import http from './http';

/** Полезный контакт (поставщик, служба, партнёр) */
export interface Contact {
  id: string;
  name: string;
  phone: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactPayload {
  name: string;
  phone?: string | null;
  comment?: string | null;
}

export const contactsApi = {
  list: () =>
    http.get<{ data: Contact[] }>('/contacts').then(r => r.data.data),

  create: (data: ContactPayload) =>
    http.post<{ data: Contact }>('/contacts', data).then(r => r.data.data),

  update: (id: string, data: Partial<ContactPayload>) =>
    http.patch<{ data: Contact }>(`/contacts/${id}`, data).then(r => r.data.data),

  delete: (id: string) =>
    http.delete(`/contacts/${id}`),
};

import http from './http';
import { Note, NotePriority, NoteRepeat } from '@/types';

export interface NotePayload {
  text: string;
  date?: string | null;
  allDay: boolean;
  time?: string | null;
  repeat?: NoteRepeat | null;
  priority: NotePriority;
  servicemanId?: string;
}

export const notesApi = {
  getAll: (servicemanId?: string, archive = false) =>
    http.get<{ data: Note[] }>('/notes', {
      params: { ...(servicemanId ? { servicemanId } : {}), archive },
    }).then(r => r.data.data),

  create: (data: NotePayload) =>
    http.post<{ data: Note }>('/notes', data).then(r => r.data.data),

  update: (id: string, data: Partial<NotePayload & { isDone: boolean }>) =>
    http.patch<{ data: Note }>(`/notes/${id}`, data).then(r => r.data.data),

  delete: (id: string) =>
    http.delete(`/notes/${id}`),
};

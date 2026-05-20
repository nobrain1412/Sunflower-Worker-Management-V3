import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './useApi';

const KEY_TASKS = (scope) => ['todo-tasks', scope];
const KEY_CATEGORIES = ['todo-categories'];

export function useTodoTasks({ scope = 'both', enabled = true } = {}) {
  return useQuery({
    queryKey: KEY_TASKS(scope),
    queryFn:  () => api.get('/todo', { params: { scope } }).then((r) => r.data ?? []),
    enabled,
    staleTime: 10_000,
  });
}

export function useTodoCategories({ activeOnly = false } = {}) {
  return useQuery({
    queryKey: [...KEY_CATEGORIES, activeOnly],
    queryFn:  () => api.get('/todo/categories', { params: activeOnly ? { active: 'true' } : {} })
      .then((r) => r.data ?? []),
    placeholderData: [],
    staleTime: 60_000,
  });
}

function invalidateTasks(qc) {
  qc.invalidateQueries({ queryKey: ['todo-tasks'] });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/todo', body),
    onSuccess:  () => invalidateTasks(qc),
  });
}

export function useToggleTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, hoan_thanh }) => api.patch(`/todo/${id}/toggle`, { hoan_thanh }),
    onSuccess:  () => invalidateTasks(qc),
  });
}

export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/todo/${id}`, body),
    onSuccess:  () => invalidateTasks(qc),
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/todo/${id}`),
    onSuccess:  () => invalidateTasks(qc),
  });
}

// Category mutations (admin)
export function useCreateTodoCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/todo/categories', body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY_CATEGORIES }),
  });
}
export function useUpdateTodoCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/todo/categories/${id}`, body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY_CATEGORIES }),
  });
}
export function useDeleteTodoCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/todo/categories/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY_CATEGORIES }),
  });
}

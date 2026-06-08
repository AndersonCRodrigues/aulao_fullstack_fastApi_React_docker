export interface Task {
  id: string;
  title: string;
  content_enc?: string;
  completed: boolean;
  created_at: string;
  owner_id: string;
}
import { useState } from 'react';
import { AuthForm } from './components/AuthForm';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';

function App() {
  const [isLogged, setIsLogged] = useState(!!localStorage.getItem('token'));
  const [refresh, setRefresh] = useState(false);

  if (!isLogged) return <AuthForm onLogin={() => setIsLogged(true)} />;

  return (
    <div>
      <h1>Minhas Tarefas</h1>
      <TaskForm onTaskCreated={() => setRefresh(!refresh)} />
      <TaskList />
    </div>
  );
}
export default App;
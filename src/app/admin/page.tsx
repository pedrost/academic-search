import { TaskQueue } from '@/components/admin/TaskQueue'

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-200 mb-6">Painel do Operador</h1>
      <TaskQueue />
    </div>
  )
}

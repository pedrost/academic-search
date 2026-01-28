import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TaskQueue } from '@/components/admin/TaskQueue'
import { ScraperStatus } from '@/components/admin/ScraperStatus'

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Painel do Operador</h1>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Fila de Tarefas</TabsTrigger>
          <TabsTrigger value="scrapers">Scrapers</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-6">
          <TaskQueue />
        </TabsContent>

        <TabsContent value="scrapers" className="mt-6">
          <ScraperStatus />
        </TabsContent>
      </Tabs>
    </div>
  )
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function LeavePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leave Management</h1>
        <p className="text-muted-foreground">Manage leave applications and policies</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leave Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Leave application management interface with approval workflow will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

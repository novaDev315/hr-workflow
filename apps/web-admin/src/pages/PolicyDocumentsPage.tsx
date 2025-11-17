import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, FileText, Download } from 'lucide-react'

export function PolicyDocumentsPage() {
  const policies = [
    {
      id: '1',
      title: 'Employee Handbook',
      category: 'Handbook',
      version: '2.0',
      effectiveDate: '2024-01-01',
      description: 'Complete guide for employees',
      status: 'Published',
    },
    {
      id: '2',
      title: 'Leave Policy',
      category: 'Leave Policy',
      version: '1.5',
      effectiveDate: '2024-01-01',
      description: 'Leave types, accrual, and application process',
      status: 'Published',
    },
    {
      id: '3',
      title: 'Code of Conduct',
      category: 'Code of Conduct',
      version: '3.0',
      effectiveDate: '2024-01-01',
      description: 'Expected behavior and ethics guidelines',
      status: 'Published',
    },
    {
      id: '4',
      title: 'Work from Home Policy',
      category: 'HR Policy',
      version: '1.0',
      effectiveDate: '2024-06-01',
      description: 'Guidelines for remote work',
      status: 'Published',
    },
    {
      id: '5',
      title: 'IT Security Policy',
      category: 'IT Policy',
      version: '2.1',
      effectiveDate: '2024-03-01',
      description: 'Information security and data protection',
      status: 'Published',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Policy Documents</h1>
          <p className="text-muted-foreground">Company policies and handbooks</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Upload Policy
        </Button>
      </div>

      {/* Policies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {policies.map((policy) => (
          <Card key={policy.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <FileText className="w-8 h-8 text-primary" />
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {policy.status}
                </span>
              </div>
              <CardTitle className="mt-3">{policy.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{policy.description}</p>
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="font-medium">{policy.category}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Version:</span>
                    <span className="font-medium">{policy.version}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Effective:</span>
                    <span className="font-medium">{policy.effectiveDate}</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

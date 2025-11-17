import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, FileText, Calendar, CheckCircle } from 'lucide-react'

export function RecruitmentPage() {
  const stats = [
    { title: 'Active Openings', value: '15', icon: FileText, color: 'text-blue-600' },
    { title: 'Total Applications', value: '342', icon: Users, color: 'text-green-600' },
    { title: 'Interviews Scheduled', value: '23', icon: Calendar, color: 'text-orange-600' },
    { title: 'Offers Sent', value: '8', icon: CheckCircle, color: 'text-purple-600' },
  ]

  const recentApplications = [
    {
      id: '1',
      candidateName: 'Ankit Verma',
      position: 'Senior Developer',
      appliedDate: '2024-11-15',
      status: 'Shortlisted',
      experience: '5 years',
    },
    {
      id: '2',
      candidateName: 'Neha Singh',
      position: 'HR Executive',
      appliedDate: '2024-11-14',
      status: 'Interview Scheduled',
      experience: '3 years',
    },
    {
      id: '3',
      candidateName: 'Rajesh Gupta',
      position: 'Sales Manager',
      appliedDate: '2024-11-13',
      status: 'Screening',
      experience: '8 years',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Recruitment</h1>
          <p className="text-muted-foreground">Manage hiring pipeline</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Job Opening
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Applications */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Candidate</th>
                  <th className="text-left py-3 px-4">Position</th>
                  <th className="text-left py-3 px-4">Experience</th>
                  <th className="text-left py-3 px-4">Applied Date</th>
                  <th className="text-left py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentApplications.map((app) => (
                  <tr key={app.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{app.candidateName}</td>
                    <td className="py-3 px-4">{app.position}</td>
                    <td className="py-3 px-4">{app.experience}</td>
                    <td className="py-3 px-4">{app.appliedDate}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {app.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

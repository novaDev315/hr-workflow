import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, UserMinus, CheckCircle, Clock, AlertTriangle, FileCheck } from 'lucide-react';
import { toast } from 'sonner';

const GET_ONBOARDING_DATA = gql`
  query GetOnboardingData {
    onboardingDashboard {
      activeOnboardings
      pendingTasks
      completedThisMonth
    }
    offboardingDashboard {
      activeOffboardings
      pendingClearances
      exitingThisMonth
    }
    activeOnboardings: onboardingProcesses(status: IN_PROGRESS) {
      id
      employeeId
      status
      progress
      startDate
      targetEndDate
      employee { firstName lastName employeeNumber department { name } }
    }
    activeOffboardings: offboardingProcesses(status: IN_PROGRESS) {
      id
      employeeId
      exitType
      lastWorkingDate
      status
      progress
      clearanceStatus
      employee { firstName lastName employeeNumber }
    }
  }
`;

export default function OnboardingDashboard() {
  const { data, loading, refetch } = useQuery(GET_ONBOARDING_DATA);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  const onboardingStats = data?.onboardingDashboard || {};
  const offboardingStats = data?.offboardingDashboard || {};
  const activeOnboardings = data?.activeOnboardings || [];
  const activeOffboardings = data?.activeOffboardings || [];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      NOT_STARTED: 'bg-gray-100 text-gray-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      ON_HOLD: 'bg-yellow-100 text-yellow-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Onboarding & Offboarding</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Onboarding Stats */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <UserPlus className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-500">Active Onboardings</p>
                <p className="text-2xl font-bold">{onboardingStats.activeOnboardings || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-gray-500">Pending Tasks</p>
                <p className="text-2xl font-bold">{onboardingStats.pendingTasks || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-500">Completed (Month)</p>
                <p className="text-2xl font-bold">{onboardingStats.completedThisMonth || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Offboarding Stats */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <UserMinus className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm text-gray-500">Active Offboardings</p>
                <p className="text-2xl font-bold">{offboardingStats.activeOffboardings || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-500">Pending Clearances</p>
                <p className="text-2xl font-bold">{offboardingStats.pendingClearances || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileCheck className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-500">Exiting (Month)</p>
                <p className="text-2xl font-bold">{offboardingStats.exitingThisMonth || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="onboarding">
        <TabsList>
          <TabsTrigger value="onboarding">
            <UserPlus className="h-4 w-4 mr-2" /> Onboarding
          </TabsTrigger>
          <TabsTrigger value="offboarding">
            <UserMinus className="h-4 w-4 mr-2" /> Offboarding
          </TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="onboarding" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle>Active Onboardings</CardTitle>
              <Button>Initiate Onboarding</Button>
            </CardHeader>
            <CardContent>
              {activeOnboardings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No active onboarding processes</p>
              ) : (
                <div className="space-y-4">
                  {activeOnboardings.map((process: any) => (
                    <div key={process.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-medium">
                            {process.employee?.firstName} {process.employee?.lastName}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {process.employee?.employeeNumber} | {process.employee?.department?.name}
                          </p>
                        </div>
                        <Badge className={getStatusColor(process.status)}>
                          {process.status}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span className="font-medium">{process.progress}%</span>
                        </div>
                        <Progress value={process.progress} className="h-2" />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Started: {new Date(process.startDate).toLocaleDateString()}</span>
                          <span>Target: {new Date(process.targetEndDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="mt-3">
                        View Tasks
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offboarding" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle>Active Offboardings</CardTitle>
              <Button variant="destructive">Initiate Offboarding</Button>
            </CardHeader>
            <CardContent>
              {activeOffboardings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No active offboarding processes</p>
              ) : (
                <div className="space-y-4">
                  {activeOffboardings.map((process: any) => (
                    <div key={process.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-medium">
                            {process.employee?.firstName} {process.employee?.lastName}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {process.employee?.employeeNumber}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive">{process.exitType}</Badge>
                          <p className="text-xs text-gray-500 mt-1">
                            LWD: {new Date(process.lastWorkingDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span className="font-medium">{process.progress}%</span>
                        </div>
                        <Progress value={process.progress} className="h-2" />
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline">{process.clearanceStatus}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button variant="outline" size="sm">View Tasks</Button>
                        <Button variant="outline" size="sm">Asset Returns</Button>
                        <Button variant="outline" size="sm">Exit Interview</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Onboarding Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium">Standard Onboarding</p>
                      <p className="text-sm text-gray-500">12 tasks | 30 day cycle</p>
                    </div>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>
                  <div className="p-3 border rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium">Executive Onboarding</p>
                      <p className="text-sm text-gray-500">18 tasks | 45 day cycle</p>
                    </div>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4">Create Template</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Offboarding Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium">Resignation Template</p>
                      <p className="text-sm text-gray-500">10 tasks | Exit interview required</p>
                    </div>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>
                  <div className="p-3 border rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium">Termination Template</p>
                      <p className="text-sm text-gray-500">8 tasks | Immediate clearance</p>
                    </div>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4">Create Template</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

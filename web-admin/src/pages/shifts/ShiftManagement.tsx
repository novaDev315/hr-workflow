import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Calendar, Clock, Users, ArrowRightLeft, Plus, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';

const GET_SHIFT_DATA = gql`
  query GetShiftData {
    shiftDefinitions {
      id
      name
      code
      startTime
      endTime
      workingHours
      isNightShift
      nightDifferential
      color
      isActive
    }
    rotationPatterns {
      id
      name
      code
      cycleDays
      isActive
    }
    swapRequests(status: PENDING_APPROVAL) {
      id
      requestNumber
      requesterId
      targetEmployeeId
      status
      createdAt
    }
  }
`;

const CREATE_SHIFT = gql`
  mutation CreateShift($input: CreateShiftDefinitionInput!) {
    createShiftDefinition(input: $input) {
      id
      name
      code
    }
  }
`;

export default function ShiftManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newShift, setNewShift] = useState({
    name: '',
    code: '',
    startTime: '09:00',
    endTime: '18:00',
    workingHours: 8,
    isNightShift: false,
    nightDifferential: 0,
    color: '#3B82F6',
  });

  const { data, loading, refetch } = useQuery(GET_SHIFT_DATA);
  const [createShift, { loading: creating }] = useMutation(CREATE_SHIFT, {
    onCompleted: () => {
      toast.success('Shift created successfully');
      setIsCreateOpen(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreateShift = () => {
    createShift({ variables: { input: newShift } });
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  const shifts = data?.shiftDefinitions || [];
  const patterns = data?.rotationPatterns || [];
  const pendingSwaps = data?.swapRequests || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Shift Management</h1>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Create Shift</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Shift</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Shift Name</Label>
                  <Input
                    value={newShift.name}
                    onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                    placeholder="Morning Shift"
                  />
                </div>
                <div>
                  <Label>Code</Label>
                  <Input
                    value={newShift.code}
                    onChange={(e) => setNewShift({ ...newShift, code: e.target.value.toUpperCase() })}
                    placeholder="MORNING"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={newShift.startTime}
                    onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={newShift.endTime}
                    onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newShift.isNightShift}
                    onChange={(e) => setNewShift({ ...newShift, isNightShift: e.target.checked })}
                  />
                  Night Shift
                </label>
                {newShift.isNightShift && (
                  <div className="flex items-center gap-2">
                    <Label>Differential %</Label>
                    <Input
                      type="number"
                      className="w-20"
                      value={newShift.nightDifferential}
                      onChange={(e) => setNewShift({ ...newShift, nightDifferential: parseFloat(e.target.value) })}
                    />
                  </div>
                )}
              </div>
              <div>
                <Label>Color</Label>
                <Input
                  type="color"
                  value={newShift.color}
                  onChange={(e) => setNewShift({ ...newShift, color: e.target.value })}
                  className="h-10 w-20"
                />
              </div>
              <Button onClick={handleCreateShift} disabled={creating} className="w-full">
                {creating ? 'Creating...' : 'Create Shift'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-500">Total Shifts</p>
                <p className="text-2xl font-bold">{shifts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Moon className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-500">Night Shifts</p>
                <p className="text-2xl font-bold">{shifts.filter((s: any) => s.isNightShift).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-500">Rotation Patterns</p>
                <p className="text-2xl font-bold">{patterns.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-gray-500">Pending Swaps</p>
                <p className="text-2xl font-bold">{pendingSwaps.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="shifts">
        <TabsList>
          <TabsTrigger value="shifts">Shift Definitions</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="rotations">Rotation Patterns</TabsTrigger>
          <TabsTrigger value="swaps">Swap Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="shifts" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">Shift</th>
                    <th className="px-4 py-3 text-left">Code</th>
                    <th className="px-4 py-3 text-left">Timing</th>
                    <th className="px-4 py-3 text-left">Hours</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift: any) => (
                    <tr key={shift.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: shift.color }}
                          />
                          {shift.name}
                        </div>
                      </td>
                      <td className="px-4 py-3">{shift.code}</td>
                      <td className="px-4 py-3">{shift.startTime} - {shift.endTime}</td>
                      <td className="px-4 py-3">{shift.workingHours}h</td>
                      <td className="px-4 py-3">
                        {shift.isNightShift ? (
                          <Badge className="bg-purple-100 text-purple-800">
                            <Moon className="h-3 w-3 mr-1" /> Night (+{shift.nightDifferential}%)
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            <Sun className="h-3 w-3 mr-1" /> Day
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={shift.isActive ? 'default' : 'secondary'}>
                          {shift.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="outline" size="sm">Edit</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Schedule View</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Schedule calendar view - Select employees and dates to manage shift assignments.</p>
              {/* Calendar implementation would go here */}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rotations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Rotation Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              {patterns.length === 0 ? (
                <p className="text-gray-500">No rotation patterns defined yet.</p>
              ) : (
                <div className="space-y-4">
                  {patterns.map((pattern: any) => (
                    <div key={pattern.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-medium">{pattern.name}</h3>
                          <p className="text-sm text-gray-500">Code: {pattern.code} | Cycle: {pattern.cycleDays} days</p>
                        </div>
                        <Button variant="outline" size="sm">View Pattern</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="swaps" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Swap Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingSwaps.length === 0 ? (
                <p className="text-gray-500">No pending swap requests.</p>
              ) : (
                <div className="space-y-4">
                  {pendingSwaps.map((swap: any) => (
                    <div key={swap.id} className="p-4 border rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-medium">{swap.requestNumber}</p>
                        <p className="text-sm text-gray-500">
                          Created: {new Date(swap.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-green-600">Approve</Button>
                        <Button size="sm" variant="destructive">Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock, Calendar, FileText, User, Bell,
  CheckCircle, AlertCircle, TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';

const GET_EMPLOYEE_DASHBOARD = gql`
  query GetEmployeeDashboard($employeeId: ID!) {
    employee(id: $employeeId) {
      id
      firstName
      lastName
      employeeNumber
      department { name }
      designation { title }
    }
    attendanceSummary(employeeId: $employeeId) {
      presentDays
      absentDays
      leaveDays
      totalWorkingDays
      attendancePercentage
    }
    leaveBalances(employeeId: $employeeId) {
      leaveType
      totalDays
      usedDays
      remainingDays
    }
    pendingRequests(employeeId: $employeeId) {
      leaveRequests
      attendanceCorrections
    }
    announcements(limit: 5) {
      id
      title
      priority
      publishedAt
    }
  }
`;

export default function EmployeeDashboard() {
  const employeeId = localStorage.getItem('employeeId');

  const { data, loading, error } = useQuery(GET_EMPLOYEE_DASHBOARD, {
    variables: { employeeId },
    skip: !employeeId,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const employee = data?.employee;
  const attendance = data?.attendanceSummary;
  const leaveBalances = data?.leaveBalances || [];
  const pending = data?.pendingRequests;
  const announcements = data?.announcements || [];

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold">
          Welcome back, {employee?.firstName}!
        </h1>
        <p className="text-blue-100 mt-1">
          {employee?.designation?.title} | {employee?.department?.name}
        </p>
        <p className="text-blue-200 text-sm mt-2">
          Employee ID: {employee?.employeeNumber}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/self-service/attendance">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 mx-auto text-blue-600 mb-2" />
              <p className="font-medium">Clock In/Out</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/self-service/leave">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-4 text-center">
              <Calendar className="h-8 w-8 mx-auto text-green-600 mb-2" />
              <p className="font-medium">Request Leave</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/self-service/payslips">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-4 text-center">
              <FileText className="h-8 w-8 mx-auto text-purple-600 mb-2" />
              <p className="font-medium">View Payslips</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/self-service/profile">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-4 text-center">
              <User className="h-8 w-8 mx-auto text-orange-600 mb-2" />
              <p className="font-medium">My Profile</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Attendance Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              This Month's Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Present Days</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  {attendance?.presentDays || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Leave Days</span>
                <Badge variant="default" className="bg-blue-100 text-blue-800">
                  {attendance?.leaveDays || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Absent Days</span>
                <Badge variant="default" className="bg-red-100 text-red-800">
                  {attendance?.absentDays || 0}
                </Badge>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Attendance Rate</span>
                  <span className="text-lg font-bold text-blue-600">
                    {attendance?.attendancePercentage || 0}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leave Balance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Leave Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaveBalances.slice(0, 4).map((balance: any) => (
                <div key={balance.leaveType} className="flex justify-between items-center">
                  <span className="text-gray-600">{balance.leaveType}</span>
                  <div className="text-right">
                    <span className="font-bold text-blue-600">{balance.remainingDays}</span>
                    <span className="text-gray-400 text-sm"> / {balance.totalDays}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/self-service/leave">
              <Button variant="outline" className="w-full mt-4">
                View All & Apply Leave
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Pending Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Pending Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                <span>Leave Requests</span>
                <Badge variant="outline" className="bg-yellow-100">
                  {pending?.leaveRequests || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span>Attendance Corrections</span>
                <Badge variant="outline" className="bg-orange-100">
                  {pending?.attendanceCorrections || 0}
                </Badge>
              </div>
            </div>
            <Link to="/self-service/requests">
              <Button variant="outline" className="w-full mt-4">
                View All Requests
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Announcements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recent Announcements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No announcements</p>
          ) : (
            <div className="space-y-3">
              {announcements.map((announcement: any) => (
                <div
                  key={announcement.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {announcement.priority === 'HIGH' && (
                      <Badge variant="destructive">Important</Badge>
                    )}
                    <span className="font-medium">{announcement.title}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(announcement.publishedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
          <Link to="/self-service/announcements">
            <Button variant="outline" className="w-full mt-4">
              View All Announcements
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Clock, MapPin, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const GET_MY_ATTENDANCE = gql`
  query GetMyAttendance($employeeId: ID!, $month: Int!, $year: Int!) {
    myAttendance(employeeId: $employeeId, month: $month, year: $year) {
      id
      date
      clockIn
      clockOut
      totalHours
      overtime
      status
      isLate
      isEarlyDeparture
    }
    todayAttendance(employeeId: $employeeId) {
      id
      clockIn
      clockOut
      status
    }
  }
`;

const CLOCK_IN = gql`
  mutation ClockIn($employeeId: ID!, $locationId: ID!, $latitude: Float!, $longitude: Float!) {
    clockIn(employeeId: $employeeId, locationId: $locationId, latitude: $latitude, longitude: $longitude) {
      id
      clockIn
      status
    }
  }
`;

const CLOCK_OUT = gql`
  mutation ClockOut($attendanceId: ID!, $latitude: Float!, $longitude: Float!) {
    clockOut(attendanceId: $attendanceId, latitude: $latitude, longitude: $longitude) {
      id
      clockOut
      totalHours
      overtime
    }
  }
`;

export default function MyAttendance() {
  const employeeId = localStorage.getItem('employeeId');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');

  const { data, loading, refetch } = useQuery(GET_MY_ATTENDANCE, {
    variables: { employeeId, month: selectedMonth, year: selectedYear },
    skip: !employeeId,
  });

  const [clockIn, { loading: clockingIn }] = useMutation(CLOCK_IN, {
    onCompleted: () => {
      toast.success('Clocked in successfully!');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const [clockOut, { loading: clockingOut }] = useMutation(CLOCK_OUT, {
    onCompleted: () => {
      toast.success('Clocked out successfully!');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const getLocation = () => {
    setGpsStatus('loading');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          setGpsStatus('success');
        },
        (error) => {
          console.error('GPS Error:', error);
          setGpsStatus('error');
          toast.error('Unable to get your location. Please enable GPS.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGpsStatus('error');
      toast.error('Geolocation is not supported by your browser');
    }
  };

  const handleClockIn = async () => {
    if (!location) {
      toast.error('Please get your GPS location first');
      return;
    }
    await clockIn({
      variables: {
        employeeId,
        locationId: localStorage.getItem('primaryLocationId'),
        latitude: location.lat,
        longitude: location.lon,
      },
    });
  };

  const handleClockOut = async () => {
    if (!location) {
      toast.error('Please get your GPS location first');
      return;
    }
    await clockOut({
      variables: {
        attendanceId: data?.todayAttendance?.id,
        latitude: location.lat,
        longitude: location.lon,
      },
    });
  };

  const todayAttendance = data?.todayAttendance;
  const attendanceRecords = data?.myAttendance || [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">My Attendance</h1>

      {/* Clock In/Out Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today's Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* GPS Status */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                <span className="font-medium">GPS Location</span>
              </div>

              {gpsStatus === 'idle' && (
                <Button onClick={getLocation} variant="outline">
                  Get My Location
                </Button>
              )}

              {gpsStatus === 'loading' && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  Getting location...
                </div>
              )}

              {gpsStatus === 'success' && location && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                    Location captured
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Lat: {location.lat.toFixed(6)}, Lon: {location.lon.toFixed(6)}
                  </p>
                  <Button onClick={getLocation} variant="link" className="p-0 h-auto text-sm">
                    Refresh location
                  </Button>
                </div>
              )}

              {gpsStatus === 'error' && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700">
                    <XCircle className="h-5 w-5" />
                    Location error
                  </div>
                  <Button onClick={getLocation} variant="link" className="p-0 h-auto text-sm">
                    Try again
                  </Button>
                </div>
              )}
            </div>

            {/* Clock In/Out Buttons */}
            <div className="space-y-4">
              {!todayAttendance?.clockIn ? (
                <div>
                  <p className="text-gray-600 mb-2">You haven't clocked in today</p>
                  <Button
                    onClick={handleClockIn}
                    disabled={!location || clockingIn}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    {clockingIn ? 'Clocking In...' : 'Clock In'}
                  </Button>
                </div>
              ) : !todayAttendance?.clockOut ? (
                <div>
                  <p className="text-gray-600 mb-2">
                    Clocked in at: <strong>{new Date(todayAttendance.clockIn).toLocaleTimeString()}</strong>
                  </p>
                  <Button
                    onClick={handleClockOut}
                    disabled={!location || clockingOut}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    {clockingOut ? 'Clocking Out...' : 'Clock Out'}
                  </Button>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 mb-2">
                    <CheckCircle className="h-5 w-5" />
                    Attendance completed for today
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>Clock In: {new Date(todayAttendance.clockIn).toLocaleTimeString()}</p>
                    <p>Clock Out: {new Date(todayAttendance.clockOut).toLocaleTimeString()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance History */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
          <div className="flex gap-2 mt-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="border rounded px-2 py-1"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="border rounded px-2 py-1"
            >
              {[2023, 2024, 2025].map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Clock In</th>
                  <th className="px-4 py-3 text-left">Clock Out</th>
                  <th className="px-4 py-3 text-left">Hours</th>
                  <th className="px-4 py-3 text-left">Overtime</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRecords.map((record: any) => (
                  <tr key={record.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {new Date(record.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : '-'}
                      {record.isLate && (
                        <Badge variant="destructive" className="ml-2 text-xs">Late</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : '-'}
                      {record.isEarlyDeparture && (
                        <Badge variant="outline" className="ml-2 text-xs">Early</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">{record.totalHours?.toFixed(2) || '-'}</td>
                    <td className="px-4 py-3">
                      {record.overtime > 0 ? (
                        <Badge variant="default" className="bg-blue-100 text-blue-800">
                          +{record.overtime?.toFixed(2)}h
                        </Badge>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={record.status === 'APPROVED' ? 'default' : 'outline'}
                        className={
                          record.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          record.status === 'PENDING_L1' ? 'bg-yellow-100 text-yellow-800' :
                          ''
                        }
                      >
                        {record.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

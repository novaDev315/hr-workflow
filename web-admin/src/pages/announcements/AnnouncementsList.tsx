import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Bell, Plus, Send, Archive, Eye, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const GET_ANNOUNCEMENTS = gql`
  query GetAnnouncements {
    announcements {
      id
      title
      summary
      content
      priority
      status
      targetAudience
      publishedAt
      readCount
      acknowledgmentRequired
      createdAt
    }
    announcementStats {
      total
      published
      draft
      scheduled
      totalReads
      highPriorityActive
    }
  }
`;

const CREATE_ANNOUNCEMENT = gql`
  mutation CreateAnnouncement($input: CreateAnnouncementInput!) {
    createAnnouncement(input: $input) {
      id
      title
    }
  }
`;

const PUBLISH_ANNOUNCEMENT = gql`
  mutation PublishAnnouncement($id: ID!) {
    publishAnnouncement(id: $id) {
      id
      status
    }
  }
`;

export default function AnnouncementsList() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    summary: '',
    priority: 'NORMAL',
    targetAudience: 'ALL',
    acknowledgmentRequired: false,
  });

  const { data, loading, refetch } = useQuery(GET_ANNOUNCEMENTS);

  const [createAnnouncement, { loading: creating }] = useMutation(CREATE_ANNOUNCEMENT, {
    onCompleted: () => {
      toast.success('Announcement created');
      setIsCreateOpen(false);
      setNewAnnouncement({ title: '', content: '', summary: '', priority: 'NORMAL', targetAudience: 'ALL', acknowledgmentRequired: false });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [publishAnnouncement] = useMutation(PUBLISH_ANNOUNCEMENT, {
    onCompleted: () => {
      toast.success('Announcement published');
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading) return <div className="p-6">Loading...</div>;

  const announcements = data?.announcements || [];
  const stats = data?.announcementStats || {};

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: 'bg-gray-100 text-gray-800',
      NORMAL: 'bg-blue-100 text-blue-800',
      HIGH: 'bg-orange-100 text-orange-800',
      URGENT: 'bg-red-100 text-red-800',
    };
    return colors[priority] || 'bg-gray-100';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      SCHEDULED: 'bg-yellow-100 text-yellow-800',
      PUBLISHED: 'bg-green-100 text-green-800',
      ARCHIVED: 'bg-purple-100 text-purple-800',
    };
    return colors[status] || 'bg-gray-100';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Announcements</h1>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Create Announcement</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Announcement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                  placeholder="Announcement title"
                />
              </div>
              <div>
                <Label>Summary (optional)</Label>
                <Input
                  value={newAnnouncement.summary}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, summary: e.target.value })}
                  placeholder="Brief summary for preview"
                />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                  placeholder="Full announcement content..."
                  rows={5}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={newAnnouncement.priority}
                    onValueChange={(v) => setNewAnnouncement({ ...newAnnouncement, priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Target Audience</Label>
                  <Select
                    value={newAnnouncement.targetAudience}
                    onValueChange={(v) => setNewAnnouncement({ ...newAnnouncement, targetAudience: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Employees</SelectItem>
                      <SelectItem value="DEPARTMENT">Specific Departments</SelectItem>
                      <SelectItem value="DESIGNATION">Specific Designations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ack"
                  checked={newAnnouncement.acknowledgmentRequired}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, acknowledgmentRequired: e.target.checked })}
                />
                <Label htmlFor="ack">Require acknowledgment from employees</Label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => createAnnouncement({ variables: { input: newAnnouncement } })}
                  disabled={creating || !newAnnouncement.title || !newAnnouncement.content}
                  className="flex-1"
                >
                  Save as Draft
                </Button>
                <Button
                  onClick={() => createAnnouncement({ variables: { input: { ...newAnnouncement, publishNow: true } } })}
                  disabled={creating || !newAnnouncement.title || !newAnnouncement.content}
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-2" /> Publish Now
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Bell className="h-6 w-6 mx-auto text-blue-600 mb-1" />
            <p className="text-2xl font-bold">{stats.total || 0}</p>
            <p className="text-xs text-gray-500">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-6 w-6 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold">{stats.published || 0}</p>
            <p className="text-xs text-gray-500">Published</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Archive className="h-6 w-6 mx-auto text-gray-600 mb-1" />
            <p className="text-2xl font-bold">{stats.draft || 0}</p>
            <p className="text-xs text-gray-500">Drafts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-6 w-6 mx-auto text-red-600 mb-1" />
            <p className="text-2xl font-bold">{stats.highPriorityActive || 0}</p>
            <p className="text-xs text-gray-500">High Priority</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Eye className="h-6 w-6 mx-auto text-purple-600 mb-1" />
            <p className="text-2xl font-bold">{stats.totalReads || 0}</p>
            <p className="text-xs text-gray-500">Total Reads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-6 w-6 mx-auto text-orange-600 mb-1" />
            <p className="text-2xl font-bold">{stats.scheduled || 0}</p>
            <p className="text-xs text-gray-500">Scheduled</p>
          </CardContent>
        </Card>
      </div>

      {/* Announcements List */}
      <Card>
        <CardHeader>
          <CardTitle>All Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No announcements yet. Create your first announcement!</p>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement: any) => (
                <div key={announcement.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getPriorityColor(announcement.priority)}>
                          {announcement.priority}
                        </Badge>
                        <Badge className={getStatusColor(announcement.status)}>
                          {announcement.status}
                        </Badge>
                        {announcement.acknowledgmentRequired && (
                          <Badge variant="outline">Acknowledgment Required</Badge>
                        )}
                      </div>
                      <h3 className="font-medium text-lg">{announcement.title}</h3>
                      {announcement.summary && (
                        <p className="text-gray-600 mt-1">{announcement.summary}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span>Target: {announcement.targetAudience}</span>
                        <span>Reads: {announcement.readCount}</span>
                        {announcement.publishedAt && (
                          <span>Published: {new Date(announcement.publishedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {announcement.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          onClick={() => publishAnnouncement({ variables: { id: announcement.id } })}
                        >
                          <Send className="h-4 w-4 mr-1" /> Publish
                        </Button>
                      )}
                      <Button variant="outline" size="sm">View</Button>
                      <Button variant="outline" size="sm">Edit</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

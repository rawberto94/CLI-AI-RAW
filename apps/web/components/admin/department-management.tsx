'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Building2,
  Plus,
  Search,
  MoreVertical,
  Users,
  FolderOpen,
  Pencil,
  Trash2,
  UserPlus,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface Department {
  id: string;
  name: string;
  description?: string;
  contractTypes?: string[];
  memberCount: number;
  accessRule?: string;
  isSystem: boolean;
}

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  departments: string[];
}

const SYSTEM_DEPARTMENTS = [
  { name: 'Legal', description: 'Legal team and counsel' },
  { name: 'Finance', description: 'Finance and accounting' },
  { name: 'Operations', description: 'Operations team' },
  { name: 'Sales', description: 'Sales and business development' },
  { name: 'Procurement', description: 'Procurement and vendor management' },
  { name: 'Human Resources', description: 'HR and people operations' },
  { name: 'Executive', description: 'C-suite and executives' },
  { name: 'IT', description: 'Information technology' },
  { name: 'Compliance', description: 'Compliance and risk' },
  { name: 'Marketing', description: 'Marketing team' },
];

const CONTRACT_TYPES = [
  'nda',
  'msa',
  'sow',
  'amendment',
  'lease',
  'employment',
  'vendor',
  'customer',
  'partnership',
  'license',
];

export function DepartmentManagement() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    contractTypes: [] as string[],
  });

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/departments');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments);
      }
    } catch (error) {
      toast.error('Failed to fetch departments');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users.map((u: any) => ({
          id: u.id,
          email: u.email,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          avatar: u.avatar,
          departments: u.departments || [],
        })));
      }
    } catch (error) {
      console.error('Failed to fetch users');
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchUsers();
  }, []);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Department name is required');
      return;
    }

    try {
      const response = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error();
      toast.success('Department created');
      setShowCreateDialog(false);
      setFormData({ name: '', description: '', contractTypes: [] });
      fetchDepartments();
    } catch {
      toast.error('Failed to create department');
    }
  };

  const handleUpdate = async () => {
    if (!selectedDepartment) return;

    try {
      const response = await fetch('/api/admin/departments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedDepartment.id,
          ...formData,
        }),
      });

      if (!response.ok) throw new Error();
      toast.success('Department updated');
      setSelectedDepartment(null);
      fetchDepartments();
    } catch {
      toast.error('Failed to update department');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;

    try {
      const response = await fetch('/api/admin/departments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error();
      toast.success('Department deleted');
      fetchDepartments();
    } catch {
      toast.error('Failed to delete department');
    }
  };

  const handleAssignUser = async (userId: string, departmentIds: string[]) => {
    try {
      const response = await fetch('/api/admin/departments/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, departmentIds }),
      });

      if (!response.ok) throw new Error();
      toast.success('User assigned to departments');
      fetchUsers();
    } catch {
      toast.error('Failed to assign user');
    }
  };

  const toggleContractType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      contractTypes: prev.contractTypes.includes(type)
        ? prev.contractTypes.filter(t => t !== type)
        : [...prev.contractTypes, type],
    }));
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Departments
          </h2>
          <p className="text-muted-foreground">
            Organize users by department for streamlined access control
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="h-4 w-4 mr-2" />
                Assign Users
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Assign Users to Departments</DialogTitle>
                <DialogDescription>
                  Select users and assign them to departments
                </DialogDescription>
              </DialogHeader>

              <div className="relative my-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="max-h-[400px] overflow-auto space-y-3">
                {filteredUsers.map(user => (
                  <div key={user.id} className="border rounded-lg p-3">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {departments.map(dept => (
                        <Badge
                          key={dept.id}
                          variant={user.departments?.includes(dept.id) ? 'default' : 'outline'}
                          className="cursor-pointer text-xs"
                          onClick={() => {
                            const newDepts = user.departments?.includes(dept.id)
                              ? user.departments.filter(d => d !== dept.id)
                              : [...(user.departments || []), dept.id];
                            handleAssignUser(user.id, newDepts);
                          }}
                        >
                          {user.departments?.includes(dept.id) && (
                            <Check className="h-3 w-3 mr-1" />
                          )}
                          {dept.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button onClick={() => setShowAssignDialog(false)}>Done</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Department
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Department</DialogTitle>
                <DialogDescription>
                  Create a new department for organizing team members
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Department Name</Label>
                  <Input
                    placeholder="e.g., Product Team"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea
                    placeholder="Brief description of this department..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contract Type Access</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Members of this department can access these contract types
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CONTRACT_TYPES.map(type => (
                      <Badge
                        key={type}
                        variant={formData.contractTypes.includes(type) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleContractType(type)}
                      >
                        {formData.contractTypes.includes(type) && (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        {type.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create Department</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* System Departments Notice */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Standard Departments</CardTitle>
          <CardDescription>
            These are pre-configured departments available to all tenants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {SYSTEM_DEPARTMENTS.map(dept => (
              <Badge key={dept.name} variant="secondary">
                {dept.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Departments Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {departments.map(dept => (
          <Card key={dept.id} className={dept.isSystem ? 'opacity-80' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{dept.name}</CardTitle>
                  {dept.isSystem && <Badge variant="secondary" className="text-xs">System</Badge>}
                </div>
                {!dept.isSystem && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setSelectedDepartment(dept);
                        setFormData({
                          name: dept.name,
                          description: dept.description || '',
                          contractTypes: dept.contractTypes || [],
                        });
                      }}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(dept.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {dept.description && (
                <CardDescription>{dept.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{dept.memberCount} members</span>
                </div>
                {dept.contractTypes && dept.contractTypes.length > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FolderOpen className="h-4 w-4" />
                    <span>{dept.contractTypes.length} types</span>
                  </div>
                )}
              </div>
              {dept.contractTypes && dept.contractTypes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {dept.contractTypes.slice(0, 5).map(type => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                  {dept.contractTypes.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{dept.contractTypes.length - 5}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!selectedDepartment} onOpenChange={(open) => !open && setSelectedDepartment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Department Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Contract Type Access</Label>
              <div className="flex flex-wrap gap-2">
                {CONTRACT_TYPES.map(type => (
                  <Badge
                    key={type}
                    variant={formData.contractTypes.includes(type) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleContractType(type)}
                  >
                    {formData.contractTypes.includes(type) && (
                      <Check className="h-3 w-3 mr-1" />
                    )}
                    {type.toUpperCase()}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDepartment(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DepartmentManagement;

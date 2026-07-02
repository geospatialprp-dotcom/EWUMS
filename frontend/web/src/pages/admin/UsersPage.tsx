import { useEffect, useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Chip, IconButton, Tooltip, Alert, FormControl,
  InputLabel, Select, OutlinedInput, Checkbox, ListItemText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PersonIcon from '@mui/icons-material/Person';
import axios from 'axios';
import { usersApi, rolesApi, UserRecord, RoleRecord } from '../../services/api';
import { useDivisionScope, useDivisionScopeKey } from '../../context/DivisionContext';
import PageShell from '../../components/layout/PageShell';
import PageHeader from '../../components/layout/PageHeader';
import SurfaceCard from '../../components/layout/SurfaceCard';
import { dataTableSx } from '../../utils/pagePresentationStyles';

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 401) {
      return 'Your session has expired. Redirecting to sign in...';
    }
    const msg = err.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    if (err.response?.status === 403) return 'You do not have permission for this action.';
  }
  return 'Failed to save user. Check email uniqueness and required fields.';
}

export default function UsersPage() {
  const { activeDivision } = useDivisionScope();
  const divisionScopeKey = useDivisionScopeKey();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [divisionScope, setDivisionScope] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '', department: '', roleIds: [] as string[],
    status: 'active' as 'active' | 'inactive',
  });
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [usersRes, rolesRes] = await Promise.all([usersApi.list(), rolesApi.list()]);
      setUsers(usersRes.data.users ?? []);
      setDivisionScope(usersRes.data.divisionScope ?? activeDivision?.name ?? null);
      setRoles(rolesRes.data);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [divisionScopeKey]);

  const openCreate = () => {
    setEditing(null);
    setForm({ email: '', password: '', firstName: '', lastName: '', department: '', roleIds: [], status: 'active' });
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (user: UserRecord) => {
    setEditing(user);
    setForm({
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department ?? '',
      roleIds: user.roles.map((r) => r.id),
      status: user.status === 'inactive' ? 'inactive' : 'active',
    });
    setError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.email || !form.firstName || !form.lastName) {
      setError('Email, first name, and last name are required.');
      return;
    }
    if (!editing && (!form.password || form.password.length < 8)) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.roleIds.length === 0) {
      setError('Select at least one role.');
      return;
    }

    try {
      if (editing) {
        const payload: Record<string, unknown> = {
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          department: form.department,
          roleIds: form.roleIds,
        };
        if (form.password) payload.password = form.password;
        if (form.status) payload.status = form.status;
        await usersApi.update(editing.id, payload);
      } else {
        await usersApi.create(form);
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this user? They will not be able to sign in.')) return;
    try {
      await usersApi.remove(id);
      load();
    } catch (err) {
      setLoadError(getErrorMessage(err));
    }
  };

  const handleActivate = async (id: string) => {
    if (!confirm('Reactivate this user? They will be able to sign in again.')) return;
    try {
      await usersApi.update(id, { status: 'active' });
      load();
    } catch (err) {
      setLoadError(getErrorMessage(err));
    }
  };

  if (loading) {
    return <PageShell loading loadingLabel="Loading users…" />;
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Administration"
        title="User Management"
        accent="slate"
        actions={(
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ boxShadow: 2 }}>
            Add User
          </Button>
        )}
      />

      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}
      {divisionScope && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Showing users for division scope: <strong>{divisionScope}</strong>
        </Alert>
      )}

      <SurfaceCard title="Organization Users" flush>
        <Table sx={dataTableSx()}>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Division</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>{u.firstName} {u.lastName}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.divisionName ?? '—'}</TableCell>
                <TableCell>{u.department ?? '—'}</TableCell>
                <TableCell>
                  {u.roles.map((r) => (
                    <Chip key={r.id} label={r.name} size="small" sx={{ mr: 0.5 }} />
                  ))}
                </TableCell>
                <TableCell>
                  <Chip
                    label={u.status}
                    size="small"
                    color={u.status === 'active' ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit user & roles">
                    <IconButton size="small" onClick={() => openEdit(u)}><EditIcon /></IconButton>
                  </Tooltip>
                  {u.status === 'inactive' ? (
                    <Tooltip title="Activate user">
                      <IconButton size="small" color="success" onClick={() => handleActivate(u.id)}>
                        <PersonIcon />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Deactivate user">
                      <IconButton size="small" color="error" onClick={() => handleDeactivate(u.id)}>
                        <PersonOffIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SurfaceCard>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit User' : 'Create User'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField fullWidth label="Email" margin="dense" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField fullWidth label="First Name" margin="dense" value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <TextField fullWidth label="Last Name" margin="dense" value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <TextField fullWidth label="Department" margin="dense" value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })} />
          {!editing && (
            <TextField fullWidth label="Password" type="password" margin="dense" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          )}
          {editing && (
            <TextField fullWidth label="New Password (optional)" type="password" margin="dense"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          )}
          {editing && (
            <FormControl fullWidth margin="dense">
              <InputLabel>Status</InputLabel>
              <Select
                value={form.status}
                label="Status"
                onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
              >
                <MenuItem value="active">Active — can sign in</MenuItem>
                <MenuItem value="inactive">Inactive — blocked from sign in</MenuItem>
              </Select>
            </FormControl>
          )}
          <FormControl fullWidth margin="dense">
            <InputLabel>Roles</InputLabel>
            <Select
              multiple
              value={form.roleIds}
              onChange={(e) => {
                const value = e.target.value;
                setForm({
                  ...form,
                  roleIds: typeof value === 'string' ? value.split(',') : value,
                });
              }}
              input={<OutlinedInput label="Roles" />}
              renderValue={(selected) =>
                roles
                  .filter((r) => selected.includes(r.id))
                  .map((r) => r.name)
                  .join(', ')
              }
            >
              {roles.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  <Checkbox checked={form.roleIds.includes(r.id)} />
                  <ListItemText primary={r.name} secondary={r.code} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}

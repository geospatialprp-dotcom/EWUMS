import { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Alert,
  Checkbox,
  ListItemText,
  Typography,
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
import { AdminTableShell, adminTableContainerSx } from '../../components/admin/AdminTableShell';
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

function userInitials(user: UserRecord): string {
  const first = user.firstName?.trim().charAt(0) ?? '';
  const last = user.lastName?.trim().charAt(0) ?? '';
  return `${first}${last}`.toUpperCase() || '?';
}

function UserIdentityCell({ user }: { user: UserRecord }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Avatar
        sx={{
          width: 34,
          height: 34,
          fontSize: '0.78rem',
          fontWeight: 700,
          bgcolor: user.status === 'active' ? '#2563eb' : '#94a3b8',
        }}
      >
        {userInitials(user)}
      </Avatar>
      <Box minWidth={0}>
        <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
          {user.firstName} {user.lastName}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, display: 'block' }}>
          {user.email}
        </Typography>
      </Box>
    </Stack>
  );
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

      <AdminTableShell
        title="Division Users"
        count={users.length}
        divisionScope={divisionScope}
        emptyLabel="No users found for this division scope."
      >
        <TableContainer sx={adminTableContainerSx}>
          <Table size="small" stickyHeader sx={{ ...dataTableSx(), minWidth: 920 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 240 }}>User</TableCell>
                <TableCell sx={{ minWidth: 160 }}>Division</TableCell>
                <TableCell sx={{ minWidth: 120 }}>Department</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Roles</TableCell>
                <TableCell sx={{ minWidth: 96 }}>Status</TableCell>
                <TableCell align="right" sx={{ minWidth: 96 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell sx={{ verticalAlign: 'middle' }}>
                    <UserIdentityCell user={u} />
                  </TableCell>
                  <TableCell sx={{ verticalAlign: 'middle' }}>
                    {u.divisionName ? (
                      <Chip
                        label={u.divisionName}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          bgcolor: '#eff6ff',
                          color: '#1e40af',
                          border: '1px solid #bfdbfe',
                        }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ verticalAlign: 'middle' }}>
                    <Typography variant="body2">{u.department?.trim() || '—'}</Typography>
                  </TableCell>
                  <TableCell sx={{ verticalAlign: 'middle' }}>
                    <Stack direction="row" flexWrap="wrap" gap={0.5} useFlexGap>
                      {u.roles.map((r) => (
                        <Chip
                          key={r.id}
                          label={r.name}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 600, bgcolor: '#fff' }}
                        />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ verticalAlign: 'middle' }}>
                    <Chip
                      label={u.status === 'active' ? 'Active' : 'Inactive'}
                      size="small"
                      color={u.status === 'active' ? 'success' : 'default'}
                      sx={{ fontWeight: 700, textTransform: 'capitalize' }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <Tooltip title="Edit user & roles">
                      <IconButton size="small" onClick={() => openEdit(u)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    {u.status === 'inactive' ? (
                      <Tooltip title="Activate user">
                        <IconButton size="small" color="success" onClick={() => handleActivate(u.id)}>
                          <PersonIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Deactivate user">
                        <IconButton size="small" color="error" onClick={() => handleDeactivate(u.id)}>
                          <PersonOffIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </AdminTableShell>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit User' : 'Create User'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {divisionScope && !editing && (
            <Alert severity="info" sx={{ mb: 2 }}>
              New user will be assigned to <strong>{divisionScope}</strong>.
            </Alert>
          )}
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

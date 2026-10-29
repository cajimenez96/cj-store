'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminNav } from '@/components/admin/AdminNav';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  UserCheck,
  UserX,
  Key,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

interface UserItem {
  _id: string;
  username: string;
  name: string;
  email?: string;
  role: 'superadmin' | 'admin' | 'seller';
  active: boolean;
  createdAt: string;
}

interface CurrentAdmin {
  id?: string;
  username?: string;
  name?: string;
  role?: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  const [formUsername, setFormUsername] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'superadmin' | 'admin' | 'seller'>('admin');
  const [formActive, setFormActive] = useState(true);

  // Fetch Current Admin Info
  const fetchCurrentAdmin = async () => {
    try {
      const res = await fetch('/api/admin/auth/me');
      const json = await res.json();
      if (json.ok && json.user) {
        setCurrentUser(json.user);
      }
    } catch {
      // Ignore
    }
  };

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (json.ok) {
        setUsers(json.data);
      } else {
        toast.error(json.message || 'Error al obtener usuarios');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentAdmin();
    fetchUsers();
  }, [fetchUsers]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('admin');
    setFormActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserItem) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormName(user.name);
    setFormEmail(user.email || '');
    setFormPassword('');
    setFormRole(user.role);
    setFormActive(user.active);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingUser) {
      if (!formUsername.trim() || !formPassword.trim() || !formName.trim()) {
        toast.error('Usuario, contraseña y nombre son obligatorios');
        return;
      }
      if (formPassword.length < 6) {
        toast.error('La contraseña debe tener al menos 6 caracteres');
        return;
      }
    } else {
      if (!formName.trim()) {
        toast.error('El nombre es obligatorio');
        return;
      }
      if (formPassword.trim() && formPassword.trim().length < 6) {
        toast.error('La contraseña debe tener al menos 6 caracteres');
        return;
      }
    }

    setActionLoading('saving');

    try {
      if (!editingUser) {
        // Create
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: formUsername,
            password: formPassword,
            name: formName,
            email: formEmail,
            role: formRole,
            active: formActive,
          }),
        });

        const json = await res.json();
        if (!json.ok) throw new Error(json.message || 'Error al crear usuario');

        toast.success('Usuario creado exitosamente');
      } else {
        // Update
        const payload: Record<string, unknown> = {
          id: editingUser._id,
          name: formName,
          email: formEmail,
          role: formRole,
          active: formActive,
        };
        if (formPassword.trim()) {
          payload.password = formPassword.trim();
        }

        const res = await fetch('/api/admin/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!json.ok) throw new Error(json.message || 'Error al actualizar usuario');

        toast.success('Usuario actualizado correctamente');
      }

      closeModal();
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al procesar usuario');
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle Active / Inactive (Dar de Alta / Baja)
  const handleToggleActive = async (user: UserItem) => {
    const nextState = !user.active;
    const actionLabel = nextState ? 'dar de alta' : 'dar de baja';

    if (
      !confirm(
        `¿Estás seguro de que deseas ${actionLabel} a @${user.username}? ${
          !nextState ? 'No podrá iniciar sesión en la plataforma.' : ''
        }`
      )
    ) {
      return;
    }

    setActionLoading(user._id);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user._id,
          active: nextState,
        }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.message || 'Error al modificar estado');

      toast.success(
        nextState
          ? `Usuario @${user.username} dado de alta`
          : `Usuario @${user.username} dado de baja`
      );
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar estado');
    } finally {
      setActionLoading(null);
    }
  };

  // Delete User
  const handleDelete = async (user: UserItem) => {
    if (
      !confirm(
        `⚠️ ATENCIÓN: ¿Seguro que deseas ELIMINAR definitivamente al usuario @${user.username}? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    setActionLoading(user._id);
    try {
      const res = await fetch(`/api/admin/users?id=${user._id}`, {
        method: 'DELETE',
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.message || 'Error al eliminar usuario');

      toast.success(`Usuario @${user.username} eliminado`);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar usuario');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#111111]">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-[#e5e5e7] shadow-xs">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-black text-white rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight">
                  Gestión de Usuarios
                </h1>
                <p className="text-sm text-[#707072]">
                  Administración de accesos, roles y altas/bajas del panel de control
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-[#111111] hover:bg-[#222224] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        </div>

        {/* Users Table / List */}
        <div className="bg-white rounded-2xl border border-[#e5e5e7] shadow-xs overflow-hidden">
          <div className="p-5 border-b border-[#e5e5e7] flex items-center justify-between">
            <h2 className="font-bold text-sm uppercase tracking-wider text-[#111111] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Usuarios Registrados ({users.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-[#707072] gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#111111]" />
              <p className="text-xs font-medium uppercase tracking-wider">Cargando usuarios...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-[#707072]">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No se encontraron usuarios registrados.</p>
              <p className="text-xs text-[#9e9ea0] mt-1">Crea el primer administrador con el botón superior.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8f9fa] text-[11px] font-bold uppercase tracking-wider text-[#707072] border-b border-[#e5e5e7]">
                    <th className="py-3 px-6">Usuario</th>
                    <th className="py-3 px-6">Nombre Completo</th>
                    <th className="py-3 px-6">Email</th>
                    <th className="py-3 px-6">Rol</th>
                    <th className="py-3 px-6">Estado</th>
                    <th className="py-3 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e5e7] text-sm">
                  {users.map((u) => {
                    const isSelf = currentUser?.username === u.username;
                    const isCurrentLoading = actionLoading === u._id;

                    return (
                      <tr key={u._id} className="hover:bg-[#f8f9fa]/50 transition-colors">
                        {/* Usuario */}
                        <td className="py-4 px-6 font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-neutral-100 px-2 py-1 rounded-md text-[#111111]">
                              @{u.username}
                            </span>
                            {isSelf && (
                              <span className="text-[10px] bg-neutral-900 text-white font-bold px-1.5 py-0.5 rounded">
                                Tú
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Nombre */}
                        <td className="py-4 px-6 text-[#111111] font-medium">
                          {u.name}
                        </td>

                        {/* Email */}
                        <td className="py-4 px-6 text-[#707072] text-xs">
                          {u.email || '-'}
                        </td>

                        {/* Rol */}
                        <td className="py-4 px-6">
                          {u.role === 'superadmin' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                              <Shield className="w-3 h-3" />
                              Superadmin
                            </span>
                          ) : u.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                              <ShieldCheck className="w-3 h-3" />
                              Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-700 border border-neutral-300">
                              Vendedor
                            </span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="py-4 px-6">
                          {u.active ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider bg-red-50 text-red-700 border border-red-200">
                              <XCircle className="w-3 h-3" />
                              Inactivo
                            </span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Toggle Activo / Inactivo (Alta / Baja) */}
                            <button
                              onClick={() => handleToggleActive(u)}
                              disabled={isCurrentLoading}
                              title={u.active ? 'Dar de baja (desactivar)' : 'Dar de alta (activar)'}
                              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                                u.active
                                  ? 'border-[#e5e5e7] text-neutral-600 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {u.active ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </button>

                            {/* Editar */}
                            <button
                              onClick={() => openEditModal(u)}
                              disabled={isCurrentLoading}
                              title="Editar usuario o restablecer contraseña"
                              className="p-2 border border-[#e5e5e7] text-neutral-600 hover:text-[#111111] hover:bg-neutral-100 rounded-lg transition-all cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Eliminar (solo superadmin) */}
                            {currentUser?.role === 'superadmin' && !isSelf && (
                              <button
                                onClick={() => handleDelete(u)}
                                disabled={isCurrentLoading}
                                title="Eliminar usuario definitivamente"
                                className="p-2 border border-[#e5e5e7] text-neutral-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg transition-all cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal Crear / Editar */}
      {isModalOpen && (
        <ResponsiveModal
          open
          onOpenChange={(open) => !open && closeModal()}
          title={editingUser ? 'Editar Usuario' : 'Crear Usuario'}
          hideTitle
          className="sm:max-w-md p-0 gap-0"
          footer={
            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2.5 rounded-xl border border-[#e5e5e7] text-xs font-bold uppercase tracking-wider text-[#707072] hover:text-[#111111] hover:bg-neutral-100 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="users-form"
                disabled={actionLoading === 'saving'}
                className="px-5 py-2.5 bg-[#111111] hover:bg-[#222224] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              >
                {actionLoading === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{editingUser ? 'Guardar Cambios' : 'Crear Usuario'}</span>
              </button>
            </div>
          }
        >
          <div className="p-6 border-b border-[#e5e5e7] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-neutral-100 rounded-xl text-[#111111]">
                {editingUser ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-base text-[#111111]">
                  {editingUser ? `Editar @${editingUser.username}` : 'Nuevo Usuario'}
                </h3>
                <p className="text-xs text-[#707072]">
                  {editingUser
                    ? 'Modifica los datos o actualiza su contraseña'
                    : 'Crea una cuenta para acceder al panel de administración'}
                </p>
              </div>
            </div>
          </div>

          <form id="users-form" onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#707072] mb-1.5">
                Nombre de Usuario *
              </label>
              <input
                type="text"
                required
                disabled={Boolean(editingUser)}
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="ej: analia, juan_admin"
                className="w-full px-3.5 py-2.5 bg-[#f8f9fa] border border-[#e5e5e7] rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-60"
              />
              {editingUser && (
                <p className="text-[11px] text-[#707072] mt-1">El nombre de usuario no se puede cambiar.</p>
              )}
            </div>

            {/* Nombre completo */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#707072] mb-1.5">
                Nombre y Apellido *
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="ej: Analía Gómez"
                className="w-full px-3.5 py-2.5 bg-[#f8f9fa] border border-[#e5e5e7] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#707072] mb-1.5">
                Email (Opcional)
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="ej: analia@cjstore.com"
                className="w-full px-3.5 py-2.5 bg-[#f8f9fa] border border-[#e5e5e7] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#707072] mb-1.5">
                {editingUser ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}
              </label>
              <div className="relative">
                <input
                  type="password"
                  required={!editingUser}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? '••••••••' : 'Mínimo 6 caracteres'}
                  className="w-full px-3.5 py-2.5 bg-[#f8f9fa] border border-[#e5e5e7] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
                />
                <Key className="w-4 h-4 text-neutral-400 absolute right-3.5 top-3" />
              </div>
            </div>

            {/* Rol */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#707072] mb-1.5">
                Rol del Usuario
              </label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as 'superadmin' | 'admin' | 'seller')}
                className="w-full px-3.5 py-2.5 bg-[#f8f9fa] border border-[#e5e5e7] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
              >
                <option value="admin">Admin (Gestión completa de tienda)</option>
                {currentUser?.role === 'superadmin' && (
                  <option value="superadmin">Superadmin (Acceso total y gestión de usuarios)</option>
                )}
                <option value="seller">Vendedor (Solo pedidos y catálogo)</option>
              </select>
            </div>

            {/* Estado Activo */}
            <div className="pt-2 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#111111] block">
                  Usuario Habilitado
                </span>
                <span className="text-[11px] text-[#707072]">
                  Permite al usuario iniciar sesión en el panel
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

          </form>
        </ResponsiveModal>
      )}
    </div>
  );
}

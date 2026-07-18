import { useAuth } from '../components/AuthContext.jsx';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="profile-page">
      <section className="page-header mb-5">
        <p className="rt-overline">Configuración</p>
        <h1 className="mb-2">Perfil</h1>
        <p className="text-muted">Aquí podrás ver y actualizar tu información de usuario cuando se implemente la edición de perfil.</p>
      </section>

      <section className="profile-card rt-card p-4">
        <div className="profile-card-header mb-4">
          <h2>Datos del usuario</h2>
          <p className="text-muted mb-0">Tu información de cuenta se muestra en un formato limpio y fácil de leer.</p>
        </div>

        <div className="profile-grid">
          <div className="profile-field">
            <label className="profile-label">Usuario</label>
            <input className="rt-input" value={user?.username || ''} disabled />
          </div>
          <div className="profile-field">
            <label className="profile-label">Rol</label>
            <input className="rt-input" value={user?.role || ''} disabled />
          </div>
          <div className="profile-field profile-field-full">
            <label className="profile-label">Email</label>
            <input className="rt-input" value={user?.email || ''} disabled />
          </div>
        </div>
      </section>
    </div>
  );
}

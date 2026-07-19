import { useAuth } from '../components/AuthContext.jsx';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="container py-5">
      <div className="mb-4">
        <h1>Configuración del perfil</h1>
        <p className="text-muted">Aquí podrás ver y actualizar tu información de usuario cuando se implemente la edición de perfil.</p>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <h3>Datos del usuario</h3>
          <div className="row gy-3">
            <div className="col-md-6">
              <label className="form-label">Usuario</label>
              <input className="form-control" value={user?.username || ''} disabled />
            </div>
            <div className="col-md-6">
              <label className="form-label">Rol</label>
              <input className="form-control" value={user?.role || ''} disabled />
            </div>
            <div className="col-12">
              <label className="form-label">Email</label>
              <input className="form-control" value={user?.email || ''} disabled />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

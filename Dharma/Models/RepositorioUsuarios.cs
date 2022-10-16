namespace Arcadia.Models
{
    public class RepositorioUsuarios: IUsuario
    {
        private readonly AppDbContext? contexto;
        private List <Usuario>? listaUsuarios;

        //public RepositorioUsuarios(AppDbContext contexto)
        //{
        //    this.contexto = contexto;
        //}

        // (1) - GET ALL USERS
        public List<Usuario>? GetAllUsers()
        {
            listaUsuarios = contexto?.Usuarios.ToList<Usuario>();
            return listaUsuarios;
        }

        // (2) - GET ONE USER BY ID
        public Usuario? GetUserById(int Id)
        {
            return contexto?.Usuarios.Find(Id);
        }

        // (3) - CREATE USER
        public Usuario AddUser(Usuario usuario)
        {
            contexto?.Usuarios.Add(usuario);
            contexto?.SaveChanges();
            return usuario;
        }

        // (4) - ACTUALIZAR USUARIO
        public Usuario? UpdateUser(Usuario usuario)
        {
            var employee = contexto?.Usuarios.Attach(usuario);
            employee.State = Microsoft.EntityFrameworkCore.EntityState.Modified;
            contexto?.SaveChanges();
            return usuario;
        }

        // (5) - ELIMINAR USUARIO
        public Usuario? DeleteUser(int Id)
        {
            Usuario? usuario = contexto?.Usuarios.Find(Id);

            if (usuario != null)
            {
                contexto?.Usuarios.Remove(usuario);
                contexto?.SaveChanges();
            }

            return usuario;
        }
    }
}


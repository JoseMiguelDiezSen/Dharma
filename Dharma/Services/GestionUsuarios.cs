using Dharma.Data;
using Dharma.Models;
using Microsoft.EntityFrameworkCore;

namespace Dharma.Services
{
    public class GestionUsuarios : IUsuario
    {
        private readonly DharmaDbContext contexto;
        private List<Usuario>? listaUsuarios;

        public GestionUsuarios(DharmaDbContext contexto)
        {
            this.contexto = contexto;
        }

        // (1) - GET ALL USERS
        public List<Usuario> GetAllUsers()
        {
            listaUsuarios = contexto.Usuarios?.ToList<Usuario>();
            return listaUsuarios ?? new List<Usuario>();
        }

        // (2) - GET ONE USER BY ID
        public Usuario? GetUsuarioById(int Id)
        {
            return contexto.Usuarios.Find(Id);
        }

        // (3) - CREATE USER
        public Usuario AddUser(Usuario usuario)
        {
            contexto.Usuarios.Add(usuario);
            contexto.SaveChanges();
            return usuario;
        }

        // (4) - ACTUALIZAR USUARIOsE AJUSTAN 
        public Usuario? UpdateUser(Usuario usuario)
        {
            var entry = contexto.Usuarios.Attach(usuario);
            entry.State = EntityState.Modified;
            contexto.SaveChanges();
            return usuario;
        }

        // (5) - ELIMINAR USUARIO
        public Usuario? DeleteUser(int Id)
        {
            Usuario? usuario = contexto.Usuarios.Find(Id);

            if (usuario != null)
            {
                contexto.Usuarios.Remove(usuario);
                contexto.SaveChanges();
            }

            return usuario;
        }
    }
}


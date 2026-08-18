using Dharma.Models;

namespace Dharma.Services
{
    public interface IUsuario
    {
        List<Usuario> GetAllUsers();
        Usuario? GetUsuarioById(int id);
        Usuario AddUser(Usuario usuario);
        Usuario? UpdateUser(Usuario usuario);
        Usuario? DeleteUser(int id);
    }
}

using Dharma.Models;

namespace Dharma.Services
{
    public interface IUsuario
    {
        List<Usuario> GetAllUsers();
        Usuario AddUser(Usuario usuario);
        Usuario? UpdateUser(Usuario usuario);
        Usuario? GetUsuarioById(int idUsuario);
        Usuario? DeleteUser(int idUsuario);
    }
}

using Dharma.Models;

namespace Dharma.Services
{
    public interface IUsuario
    {
        /// <summary>
        /// Obtiene todos los usuarios
        /// </summary>
        /// <returns></returns>
        List<Usuario> GetAllUsers();

        /// <summary>
        /// Obtiene un usuario concreto en funcion del identificador
        /// </summary>
        /// <param name="idUsuario"> Identificador del usuario </param>
        /// <returns></returns>
        Usuario? GetUsuarioById(int idUsuario);

        /// <summary>
        /// Añade un usuario nuevo
        /// </summary>
        /// <param name="usuario"></param>
        /// <returns></returns>
        Usuario AddUser(Usuario usuario);

        /// <summary>
        /// Actualiza un usuario
        /// </summary>
        /// <param name="usuario"> Modelo de datos del usuario </param>
        /// <returns></returns>
        Usuario? UpdateUser(Usuario usuario);

        /// <summary>
        /// Elimina un usuario
        /// </summary>
        /// <param name="idUsuario"> Identificador del usuario </param>
        /// <returns></returns>
        Usuario? DeleteUser(int idUsuario);
    }
}

using Dharma.Models;     // Necesitamos Usuario
using Dharma.Services;  // Necesitamos IUsuario
using Microsoft.AspNetCore.Mvc; // ControllerBase, atributos HTTP y respuestas como Ok(), NotFound(), etc.

namespace Dharma.Controllers
{
    [Route("api/[controller]")] // Ruta base: UsuariosController -> /api/Usuarios
    [ApiController]             // Indica que esta clase es un controlador de Web API
    public class UsuariosController : ControllerBase // ControllerBase proporciona funcionalidades para responder a peticiones HTTP
    {
        // Dependencia que necesita el Controller para trabajar con usuarios.
        // El Controller conoce la INTERFAZ, no la implementación concreta.
        private readonly IUsuario _gestionUsuarios;

        // Constructor.
        // ASP.NET Core recibe automáticamente una implementación de IUsuario
        // gracias a la configuración de Dependency Injection de Program.cs.
        public UsuariosController(IUsuario gestionUsuarios)
        {
            _gestionUsuarios = gestionUsuarios; // Guardamos esa dependencia para utilizarla en los métodos
        }

        // ============================================================
        // GET - OBTENER TODOS LOS USUARIOS
        // GET /api/Usuarios
        // ============================================================
        [HttpGet]
        public IActionResult Get()
        {
            // Pedimos los usuarios a la capa que implementa IUsuario
            // y devolvemos una respuesta HTTP 200 (OK).
            return Ok(_gestionUsuarios.GetAllUsers());
        }

        // ============================================================
        // GET - OBTENER UN USUARIO POR ID
        // GET /api/Usuarios/5
        // ============================================================
        [HttpGet("{id}")] // {id} es un parámetro que llega en la URL
        public IActionResult Get(int id)
        {
            // Buscamos el usuario utilizando el ID recibido en la URL.
            var usuario = _gestionUsuarios.GetUsuarioById(id);

            // Si no existe, devolvemos HTTP 404 (Not Found).
            if (usuario == null)
            {
                return NotFound($"El usuario {id} no existe.");
            }

            // Si existe, devolvemos HTTP 200 con el usuario.
            return Ok(usuario);
        }

        // ============================================================
        // POST - CREAR USUARIO
        // POST /api/Usuarios
        // ============================================================
        [HttpPost]
        public IActionResult AgregarUsuario(Usuario usuario)
        {
            // Recibimos un Usuario desde el cuerpo de la petición y pedimos a la capa correspondiente
            // que lo añada.
            var usuarioNuevo = _gestionUsuarios.AddUser(usuario);

            // HTTP 201 (Created): indica que se ha creado correctamente.
            // También devuelve el usuario creado.
            return CreatedAtAction(
                nameof(Get),
                new { id = usuarioNuevo.IdUsuario },
                usuarioNuevo);
        }

        // ============================================================
        // PUT - ACTUALIZAR USUARIO
        // PUT /api/Usuarios/5
        // ============================================================
        [HttpPut("{idUsuario}")]
        public IActionResult UpdateUser(int idUsuario, Usuario usuario) { 


            if (usuario == null || usuario.IdUsuario != idUsuario)
                return BadRequest();

            // Comprobamos primero que el usuario exista.
            var existing = _gestionUsuarios.GetUsuarioById(idUsuario);

            // Si no existe, HTTP 404.
            if (existing == null)
                return NotFound();

            // Pedimos que se realice la actualización.
            var usuarioModificado = _gestionUsuarios.UpdateUser(usuario);

            // Devolvemos HTTP 200 con el usuario actualizado.
            return Ok(usuarioModificado);
        }

        // ============================================================
        // DELETE - ELIMINAR USUARIO
        // DELETE /api/Usuarios/5
        // ============================================================
        [HttpDelete("{idUsuario}")] // Recibe el IdUsuario desde la URL
        public IActionResult DeleteUser(int idUsuario)
        {
            // Pedimos a la capa de gestión que elimine el usuario.
            var usuarioEliminado = _gestionUsuarios.DeleteUser(idUsuario);

            // Si no existe ningún usuario con ese ID, devolvemos HTTP 404.
            if (usuarioEliminado == null)
                return NotFound();

            // Si se ha eliminado correctamente, devolvemos HTTP 200
            // junto con el usuario que acabamos de eliminar.
            return Ok(usuarioEliminado);
        }
    }
}


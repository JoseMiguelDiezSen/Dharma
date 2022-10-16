using Arcadia.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace Arcadia.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class APIController : ControllerBase
    {
        private readonly AppDbContext _context;

        // Constructor
        public APIController(AppDbContext context){
            _context = context;
        }

        // (!) - OBTENER TODOS
        // GET: api/<ValuesController>
        [HttpGet]
        public IActionResult Get()
        {
           //Este metodo esta en la clase usuarios
           RepositorioUsuarios repo = new RepositorioUsuarios();
           return Ok(repo.GetAllUsers());
        }

        // (2) - OBTENER UN USUARIO POR ID
        // GET api/<ValuesController>/5
        [HttpGet("{id}")]
        public IActionResult Get(int id)
        {
            RepositorioUsuarios repo = new RepositorioUsuarios();
            var usuario = repo.GetUserById(id);

            // Si no hay usuario vinculado al id introducido
            if (usuario == null)
            {
                var notFound = NotFound("El usuario " + id.ToString() + " no existe.");
                return notFound;
            }
            return Ok(usuario);
        }

        // (3) - CREAR USUARIO
        // POST api/<ValuesController>
        [HttpPost]
        public IActionResult AgregarUsuario(Usuario usuario)
        {
            RepositorioUsuarios repo = new RepositorioUsuarios();
            repo.AddUser(usuario);
            return CreatedAtAction(nameof(AgregarUsuario), usuario);
        }

        // ACTUALIZAR USUARIO
        // PUT api/<ValuesController>/5
        [HttpPut("{id}")]
        public IActionResult UpdateUser(Usuario usuario)
        {
            RepositorioUsuarios repo = new RepositorioUsuarios();
            repo.AddUser(usuario);
            return CreatedAtAction(nameof(UpdateUser), usuario);
        }
    }
}

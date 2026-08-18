using Dharma.Data;
using Dharma.Models;
using Dharma.Services;
using Microsoft.AspNetCore.Mvc;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace Dharma.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class APIController : ControllerBase
    {
        private readonly IUsuario _repo;

        // Constructor
        public APIController(IUsuario repo)
        {
            _repo = repo;
        }

        // (!) - OBTENER TODOS
        // GET: api/<ValuesController>
        [HttpGet]
        public IActionResult Get()
        {
           return Ok(_repo.GetAllUsers());
        }

        // (2) - OBTENER UN USUARIO POR ID
        // GET api/<ValuesController>/5
        [HttpGet("{id}")]
        public IActionResult Get(int id)
        {
            var usuario = _repo.GetUsuarioById(id);

            if (usuario == null)
            {
                return NotFound($"El usuario {id} no existe.");
            }
            return Ok(usuario);
        }

        // (3) - CREAR USUARIO
        // POST api/<ValuesController>
        [HttpPost]
        public IActionResult AgregarUsuario(Usuario usuario)
        {
            var created = _repo.AddUser(usuario);
            return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
        }

        // ACTUALIZAR USUARIO
        // PUT api/<ValuesController>/5
        [HttpPut("{id}")]
        public IActionResult UpdateUser(int id, Usuario usuario)
        {
            if (usuario == null || usuario.Id == null || usuario.Id != id)
                return BadRequest();

            var existing = _repo.GetUsuarioById(id);
            if (existing == null)
                return NotFound();

            var updated = _repo.UpdateUser(usuario);
            return Ok(updated);
        }
    }
}

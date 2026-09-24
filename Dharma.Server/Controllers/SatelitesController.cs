using Dharma.Services;
using Microsoft.AspNetCore.Mvc;

namespace Dharma.Controllers
{
    // Ruta base del controlador: /api/Satelites
    [Route("api/[controller]")]
    // Indica que es un controlador de Web API
    [ApiController]
    public class SatelitesController : ControllerBase
    {
        private readonly ISatelites _gestionSatelites;

        // Inyectamos la interfaz ISatelites a través del constructor
        public SatelitesController(ISatelites gestionSatelites)
        {
            _gestionSatelites = gestionSatelites;
        }

        // GET /api/Satelites?noradId=25544 - Obtiene telemetría en tiempo real (por defecto la ISS 25544)
        [HttpGet]
        public async Task<IActionResult> Index([FromQuery] int noradId = 25544)
        {
            var satelite = await _gestionSatelites.ObtenerPosicionAsync(noradId);
            if (satelite == null)
            {
                return NotFound(new { mensaje = $"No se pudo obtener la telemetría del satélite con ID NORAD {noradId}." });
            }
            return Ok(satelite);
        }

        // GET /api/Satelites/destacados - Obtiene el listado de satélites populares
        [HttpGet("destacados")]
        public IActionResult Destacados()
        {
            var destacados = _gestionSatelites.ObtenerSatelitesDestacados();
            return Ok(destacados);
        }
    }
}

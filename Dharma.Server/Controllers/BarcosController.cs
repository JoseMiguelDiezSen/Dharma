using Dharma.Services;
using Microsoft.AspNetCore.Mvc;

namespace Dharma.Controllers
{
    // Ruta base del controlador: /api/Barcos
    [Route("api/[controller]")]
    // Indica que es un controlador de Web API
    [ApiController]
    public class BarcosController : ControllerBase
    {
        private readonly IBarcos _gestionBarcos;

        // Inyectamos la interfaz IBarcos a través del constructor
        public BarcosController(IBarcos gestionBarcos)
        {
            _gestionBarcos = gestionBarcos;
        }

        // GET /api/Barcos - Obtiene los barcos en tiempo real desde AISStream
        [HttpGet]
        public async Task<IActionResult> Index([FromQuery] double? lamin, [FromQuery] double? lomin, [FromQuery] double? lamax, [FromQuery] double? lomax)
        {
            var barcos = await _gestionBarcos.ObtenerBarcosAsync(lamin, lomin, lamax, lomax);
            return Ok(barcos);
        }
    }
}

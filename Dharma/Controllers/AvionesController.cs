using Dharma.Services;
using Microsoft.AspNetCore.Mvc;

namespace Dharma.Controllers
{
    // Ruta base del controlador: /api/Aviones
    [Route("api/[controller]")]
    // Indica que es un controlador de Web API
    [ApiController]
    public class AvionesController : ControllerBase
    {
        private readonly IAviones _gestionAviones;

        // Inyectamos la interfaz IAviones a través del constructor
        public AvionesController(IAviones gestionAviones)
        {
            _gestionAviones = gestionAviones;
        }

        // GET /api/Aviones - Obtiene los aviones en tiempo real desde OpenSky
        [HttpGet]
        public async Task<IActionResult> Index()
        {
            var aviones = await _gestionAviones.ObtenerAvionesAsync();
            return Ok(aviones);
        }
    }
}

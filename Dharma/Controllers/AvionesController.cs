using Microsoft.AspNetCore.Mvc;

namespace Dharma.Controllers
{
    // Ruta base del controlador: /api/Aviones
    [Route("api/[controller]")]
    // Indica que es un controlador de Web API
    [ApiController]
    public class AvionesController : ControllerBase
    {
        // Método Index principal
        [HttpGet]
        public IActionResult Index()
        {
            return Ok();
        }
    }
}

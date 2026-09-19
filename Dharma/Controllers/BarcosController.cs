using Microsoft.AspNetCore.Mvc;

namespace Dharma.Controllers
{
    // Ruta base del controlador: /api/Barcos
    [Route("api/[controller]")]
    // Indica que es un controlador de Web API
    [ApiController]
    public class BarcosController : ControllerBase
    {
        // Método Index principal
        [HttpGet]
        public IActionResult Index()
        {
            return Ok();
        }
    }
}

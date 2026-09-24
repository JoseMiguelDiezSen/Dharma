using System.ComponentModel.DataAnnotations;

namespace Dharma.Models
{
    public class Usuario
    {
        public int IdUsuario { get; set; }

        public string NombreUsuario { get; set; } = string.Empty;

        public string Email { get; set; } = string.Empty;

        public int Telefono { get; set; }

        public string Password { get; set; } = string.Empty;

        public DateTime FechaAlta { get; set; }
    }
}


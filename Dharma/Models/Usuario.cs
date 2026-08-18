using System.ComponentModel.DataAnnotations;

namespace Dharma.Models
{
    public class Usuario
    {
        public int Id { get; set; }

        public string Nombre { get; set; } = string.Empty;

        public string Password { get; set; } = string.Empty;

        public string Telefono { get; set; } = string.Empty;

        public string Direccion { get; set; } = string.Empty;
    }
}

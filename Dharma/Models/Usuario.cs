using System.ComponentModel.DataAnnotations;

namespace Arcadia.Models
{
    public class Usuario
    {
        public int? Id { get; set; }

        public string? Nombre { get; set; }

        public string? password { get; set; }

        public int? telefono { get; set; }

        public string? direccion { get; set; }
    }
}

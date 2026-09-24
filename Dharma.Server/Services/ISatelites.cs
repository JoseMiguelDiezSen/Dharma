using Dharma.Models;

namespace Dharma.Services
{
    public interface ISatelites
    {
        /// <summary>
        /// Obtiene la posición orbital y telemetría en tiempo real de un satélite dado su código NORAD.
        /// Por defecto obtiene la Estación Espacial Internacional (ISS: 25544).
        /// </summary>
        Task<Satelite?> ObtenerPosicionAsync(int noradId = 25544);

        /// <summary>
        /// Devuelve un listado de satélites destacados para facilitar su seguimiento directo.
        /// </summary>
        List<SateliteDestacado> ObtenerSatelitesDestacados();
    }

    public class SateliteDestacado
    {
        public int NoradId { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Categoria { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
    }
}

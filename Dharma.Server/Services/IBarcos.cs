using Dharma.Models;

namespace Dharma.Services
{
    public interface IBarcos
    {
        /// <summary>
        /// Obtiene el listado de embarcaciones en tiempo real recibidas a través de AISStream.
        /// Si se pasan coordenadas de caja (lamin, lomin, lamax, lomax), filtra por esa región geográfica; si no, devuelve las de la zona activa.
        /// </summary>
        Task<List<Barco>> ObtenerBarcosAsync(double? lamin = null, double? lomin = null, double? lamax = null, double? lomax = null);
    }
}

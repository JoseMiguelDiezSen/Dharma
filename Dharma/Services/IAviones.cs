using Dharma.Models;

namespace Dharma.Services
{
    public interface IAviones
    {
        /// <summary>
        /// Obtiene el listado de aviones en tiempo real desde OpenSky.
        /// Si se pasan coordenadas de caja (lamin, lomin, lamax, lomax), filtra por esa región geográfica; si no, consulta a nivel global.
        /// </summary>
        Task<List<Avion>> ObtenerAvionesAsync(double? lamin = null, double? lomin = null, double? lamax = null, double? lomax = null);
    }
}

using Dharma.Models;

namespace Dharma.Services
{
    public interface IAviones
    {
        /// <summary>
        /// Obtiene el listado de aviones en vuelo/tierra en tiempo real desde OpenSky
        /// </summary>
        /// <returns>Lista de objetos Avion con sus datos y coordenadas</returns>
        Task<List<Avion>> ObtenerAvionesAsync();
    }
}

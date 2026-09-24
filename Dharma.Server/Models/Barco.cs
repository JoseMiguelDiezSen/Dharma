namespace Dharma.Models
{
    public class Barco
    {
        // Identificador marítimo único de 9 dígitos (MMSI)
        public string Mmsi { get; set; } = string.Empty;

        // Nombre de la embarcación (ej: "ESVAGT CANTABRIA")
        public string Nombre { get; set; } = string.Empty;

        // Número IMO de registro naval internacional
        public string? Imo { get; set; }

        // Indicativo de llamada por radio (Callsign)
        public string? Callsign { get; set; }

        // Código numérico del tipo de barco según estándar AIS
        public int? Tipo { get; set; }

        // Descripción legible del tipo (Carguero, Petrolero, Pesquero, Pasaje, etc.)
        public string TipoDescripcion { get; set; } = "Embarcación";

        // País deducido a partir de los dígitos MID del MMSI
        public string Pais { get; set; } = "Desconocido";

        // Emoji de la bandera correspondiente al país
        public string Bandera { get; set; } = "🌐";

        // Coordenada: Latitud
        public double? Latitud { get; set; }

        // Coordenada: Longitud
        public double? Longitud { get; set; }

        // Velocidad sobre el fondo en nudos (SOG)
        public double? Velocidad { get; set; }

        // Rumbo sobre el fondo en grados (COG, 0° - 360°)
        public double? Rumbo { get; set; }

        // Puerto o punto de destino reportado
        public string? Destino { get; set; }

        // Hora estimada de llegada (ETA)
        public string? Eta { get; set; }

        // Eslora (largo del barco) en metros
        public double? Eslora { get; set; }

        // Manga (ancho del barco) en metros
        public double? Manga { get; set; }

        // Calado estático en metros
        public double? Calado { get; set; }

        // Estado de navegación (En navegación con motor, fondeado, atracado, etc.)
        public string? EstadoNav { get; set; }

        // Fecha y hora UTC del último reporte recibido
        public DateTime UltimaActualizacion { get; set; } = DateTime.UtcNow;
    }
}

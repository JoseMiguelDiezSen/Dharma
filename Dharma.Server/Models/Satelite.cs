namespace Dharma.Models
{
    public class Satelite
    {
        // Número de catálogo NORAD del satélite (ej: 25544 para ISS, 20580 para Hubble)
        public int NoradId { get; set; }

        // Nombre oficial o común del satélite
        public string Nombre { get; set; } = string.Empty;

        // Coordenada geográfica: Latitud actual (-90° a +90°)
        public double Latitud { get; set; }

        // Coordenada geográfica: Longitud actual (-180° a +180°)
        public double Longitud { get; set; }

        // Altitud orbital sobre la superficie terrestre en kilómetros (ej: ~420 km para la ISS)
        public double AltitudKm { get; set; }

        // Velocidad orbital en km/h (ej: ~27.600 km/h)
        public double VelocidadKmH { get; set; }

        // Condición solar del satélite: "daylight" (al sol) o "eclipsed" (en la sombra terrestre)
        public string Visibilidad { get; set; } = "daylight";

        // Diámetro de la huella de cobertura terrestre en kilómetros (área visible desde el satélite)
        public double? HuellaCoberturaKm { get; set; }

        // Fotografía real o render oficial del satélite en el espacio
        public string? Foto { get; set; }

        // Agencia espacial o país responsable (ej: NASA, ESA, CNSA)
        public string? Agencia { get; set; }

        // Año en el que fue lanzado al espacio
        public int? AnioLanzamiento { get; set; }

        // Astronautas a bordo si es estación espacial tripulada
        public string? Tripulacion { get; set; }

        // Timestamp UNIX del reporte de telemetría
        public long Timestamp { get; set; }

        // Fecha y hora calculada en UTC
        public DateTime FechaUtc => DateTimeOffset.FromUnixTimeSeconds(Timestamp).UtcDateTime;
    }
}

namespace Dharma.Models
{
    public class Avion
    {
        // Identificador ICAO único de 24 bits de la aeronave (ej: 344384)
        public string Icao24 { get; set; } = string.Empty;

        // Código o número del vuelo comercial (ej: IBE3166, RYR1234)
        public string Callsign { get; set; } = string.Empty;

        // País de origen / matriculación del avión
        public string PaisOrigen { get; set; } = string.Empty;

        // Coordenada: Longitud
        public double? Longitud { get; set; }

        // Coordenada: Latitud
        public double? Latitud { get; set; }

        // Altitud de vuelo en metros
        public double? Altitud { get; set; }

        // Velocidad en km/h
        public double? Velocidad { get; set; }

        // Rumbo de vuelo en grados (0° a 360°, donde 0° es Norte)
        public double? Rumbo { get; set; }

        // Tasa vertical en m/s (positivo: subiendo, negativo: descendiendo)
        public double? TasaVertical { get; set; }

        // Indica si está rodando en tierra o en vuelo
        public bool EnTierra { get; set; }

        // Código Squawk del transpondedor (7700: Emergencia Mayday, 7600: Fallo radio, 7500: Secuestro)
        public string? Squawk { get; set; }
    }
}

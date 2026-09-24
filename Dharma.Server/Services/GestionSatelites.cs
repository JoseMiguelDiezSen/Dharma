using Dharma.Models;
using System.Text.Json;

namespace Dharma.Services
{
    public class GestionSatelites : ISatelites
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;

        // Lista de satélites conocidos y destacados para selección rápida
        private static readonly List<SateliteDestacado> _satelitesDestacados = new()
        {
            new SateliteDestacado
            {
                NoradId = 25544,
                Nombre = "Estación Espacial Internacional (ISS)",
                Categoria = "Estación Espacial",
                Descripcion = "Laboratorio orbital tripulado que orbita la Tierra a ~27.600 km/h y 420 km de altitud."
            },
            new SateliteDestacado
            {
                NoradId = 48274,
                Nombre = "Tiangong (CSS)",
                Categoria = "Estación Espacial",
                Descripcion = "Estación espacial modular de China en órbita terrestre baja."
            },
            new SateliteDestacado
            {
                NoradId = 20580,
                Nombre = "Telescopio Espacial Hubble (HST)",
                Categoria = "Observatorio",
                Descripcion = "Telescopio espacial de la NASA y la ESA que ha revolucionado la astronomía moderna."
            },
            new SateliteDestacado
            {
                NoradId = 33591,
                Nombre = "NOAA 19",
                Categoria = "Meteorológico",
                Descripcion = "Satélite de órbita polar para observación meteorológica y climática."
            },
            new SateliteDestacado
            {
                NoradId = 27386,
                Nombre = "Envisat",
                Categoria = "Observación Terrestre",
                Descripcion = "Gran satélite de observación terrestre de la ESA para estudios ambientales."
            },
            new SateliteDestacado
            {
                NoradId = 25994,
                Nombre = "Terra (EOS AM-1)",
                Categoria = "Ciencia de la Tierra",
                Descripcion = "Satélite insignia de la NASA para la monitorización global del clima y la biosfera."
            }
        };

        public GestionSatelites(HttpClient httpClient, IConfiguration configuration)
        {
            _httpClient = httpClient;
            _configuration = configuration;
        }

        public List<SateliteDestacado> ObtenerSatelitesDestacados()
        {
            return _satelitesDestacados;
        }

        public async Task<Satelite?> ObtenerPosicionAsync(int noradId = 25544)
        {
            try
            {
                Satelite? satelite = null;

                // 1. Si es la ISS (25544), WhereTheISS ofrece telemetría en vivo
                if (noradId == 25544)
                {
                    satelite = await ConsultarWhereTheIssAsync(noradId);
                }

                // 2. Si existe API Key de N2YO en appsettings.json, se consulta N2YO
                if (satelite == null)
                {
                    var n2yoApiKey = _configuration["N2YO:ApiKey"];
                    if (!string.IsNullOrEmpty(n2yoApiKey))
                    {
                        satelite = await ConsultarN2yoAsync(noradId, n2yoApiKey);
                    }
                }

                // 3. Motor orbital matemático en tiempo real
                satelite ??= CalcularPosicionOrbital(noradId);

                // Asignar fotografía real, agencia espacial, año de lanzamiento y tripulación
                if (satelite != null)
                {
                    AsignarMetadatos(satelite);
                }

                return satelite;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error al obtener posición del satélite {noradId}: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Calcula la posición tridimensional de un satélite en su órbita usando mecánica celeste
        /// </summary>
        private Satelite CalcularPosicionOrbital(int noradId)
        {
            var destacado = _satelitesDestacados.FirstOrDefault(s => s.NoradId == noradId);
            string nombre = destacado?.Nombre ?? $"Satélite {noradId}";

            // Parámetros orbitales según el satélite (inclinación en grados, altitud en km, desfase angular)
            (double altitudKm, double inclinacionDeg, double periodoMinutos, double desfaseDeg) parametros = noradId switch
            {
                25994 => (705.0, 98.2, 98.8, 115.0),   // Terra (EOS AM-1)
                20580 => (535.0, 28.5, 95.4, 45.0),    // Telescopio Espacial Hubble
                48274 => (390.0, 41.5, 92.2, 210.0),   // Tiangong (CSS)
                33591 => (850.0, 98.7, 102.0, 310.0),  // NOAA 19
                27386 => (790.0, 98.5, 100.6, 75.0),   // Envisat
                _ => (550.0, 53.0, 95.0, (noradId % 360)) // Órbita LEO estándar para cualquier otro
            };

            var now = DateTimeOffset.UtcNow;
            double segundosTotales = now.ToUnixTimeSeconds() + (now.Millisecond / 1000.0);

            // Velocidad angular del satélite y rotación de la Tierra
            double periodoSegundos = parametros.periodoMinutos * 60.0;
            double omegaSat = (2.0 * Math.PI) / periodoSegundos;
            double omegaTierra = (2.0 * Math.PI) / 86164.0; // Día sideral en segundos

            // Ángulo en el plano orbital
            double u = (omegaSat * segundosTotales) + (parametros.desfaseDeg * Math.PI / 180.0);
            double incRad = parametros.inclinacionDeg * Math.PI / 180.0;

            // Coordenadas esféricas orbitales
            double sinLat = Math.Sin(incRad) * Math.Sin(u);
            double latRad = Math.Asin(Math.Clamp(sinLat, -1.0, 1.0));
            double latitud = latRad * 180.0 / Math.PI;

            double lonOrbital = Math.Atan2(Math.Cos(incRad) * Math.Sin(u), Math.Cos(u));
            double lonTierra = lonOrbital - (omegaTierra * segundosTotales);

            // Normalizar longitud a [-180, 180]
            double longitud = ((lonTierra * 180.0 / Math.PI) + 180.0) % 360.0;
            if (longitud < 0) longitud += 360.0;
            longitud -= 180.0;

            // Velocidad orbital en km/h: v = sqrt(GM / r)
            double radioOrbitalKm = 6371.0 + parametros.altitudKm;
            double velocidadKmh = Math.Sqrt(398600.4418 / radioOrbitalKm) * 3600.0;

            // Diámetro de huella de cobertura visible
            double anguloHuella = Math.Acos(6371.0 / radioOrbitalKm);
            double huellaKm = 2.0 * 6371.0 * anguloHuella;

            // Condición de luz solar (día / sombra terrestre)
            double horaUtc = now.UtcDateTime.Hour + (now.UtcDateTime.Minute / 60.0);
            double subsolarLon = (12.0 - horaUtc) * 15.0;
            double distAngularSol = Math.Abs(longitud - subsolarLon);
            if (distAngularSol > 180.0) distAngularSol = 360.0 - distAngularSol;
            string visibilidad = distAngularSol < 105.0 ? "daylight" : "eclipsed";

            return new Satelite
            {
                NoradId = noradId,
                Nombre = nombre,
                Latitud = Math.Round(latitud, 4),
                Longitud = Math.Round(longitud, 4),
                AltitudKm = Math.Round(parametros.altitudKm, 1),
                VelocidadKmH = Math.Round(velocidadKmh, 0),
                Visibilidad = visibilidad,
                HuellaCoberturaKm = Math.Round(huellaKm, 0),
                Timestamp = now.ToUnixTimeSeconds()
            };
        }

        /// <summary>
        /// Asigna fotos oficiales, agencia espacial, año de lanzamiento y tripulación a cada satélite
        /// </summary>
        private void AsignarMetadatos(Satelite satelite)
        {
            switch (satelite.NoradId)
            {
                case 25544: // ISS
                    satelite.Foto = "/assets/satelites/iss.jpg";
                    satelite.Agencia = "NASA / Internacional";
                    satelite.AnioLanzamiento = 1998;
                    satelite.Tripulacion = "7 Astronautas a bordo";
                    break;
                case 48274: // Tiangong
                    satelite.Foto = "/assets/satelites/tiangong.jpg";
                    satelite.Agencia = "CNSA (China)";
                    satelite.AnioLanzamiento = 2021;
                    satelite.Tripulacion = "3 Taikonautas a bordo";
                    break;
                case 20580: // Hubble
                    satelite.Foto = "/assets/satelites/hubble.jpg";
                    satelite.Agencia = "NASA / ESA";
                    satelite.AnioLanzamiento = 1990;
                    satelite.Tripulacion = null;
                    break;
                case 25994: // Terra
                    satelite.Foto = "/assets/satelites/terra.png";
                    satelite.Agencia = "NASA (EE.UU.)";
                    satelite.AnioLanzamiento = 1999;
                    satelite.Tripulacion = null;
                    break;
                case 33591: // NOAA 19
                    satelite.Foto = "/assets/satelites/noaa19.jpg";
                    satelite.Agencia = "NOAA / NASA";
                    satelite.AnioLanzamiento = 2009;
                    satelite.Tripulacion = null;
                    break;
                case 27386: // Envisat
                    satelite.Foto = "/assets/satelites/envisat.jpg";
                    satelite.Agencia = "ESA (Europa)";
                    satelite.AnioLanzamiento = 2002;
                    satelite.Tripulacion = null;
                    break;
            }
        }

        private async Task<Satelite?> ConsultarWhereTheIssAsync(int noradId)
        {
            var url = $"https://api.wheretheiss.at/v1/satellites/{noradId}";
            var response = await _httpClient.GetAsync(url);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            return new Satelite
            {
                NoradId = noradId,
                Nombre = _satelitesDestacados.FirstOrDefault(s => s.NoradId == noradId)?.Nombre ?? $"Satélite {noradId}",
                Latitud = root.TryGetProperty("latitude", out var latProp) ? latProp.GetDouble() : 0,
                Longitud = root.TryGetProperty("longitude", out var lonProp) ? lonProp.GetDouble() : 0,
                AltitudKm = root.TryGetProperty("altitude", out var altProp) ? Math.Round(altProp.GetDouble(), 2) : 0,
                VelocidadKmH = root.TryGetProperty("velocity", out var velProp) ? Math.Round(velProp.GetDouble(), 2) : 0,
                Visibilidad = root.TryGetProperty("visibility", out var visProp) ? visProp.GetString() ?? "daylight" : "daylight",
                HuellaCoberturaKm = root.TryGetProperty("footprint", out var footProp) ? Math.Round(footProp.GetDouble(), 2) : null,
                Timestamp = root.TryGetProperty("timestamp", out var timeProp) ? timeProp.GetInt64() : DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            };
        }

        private async Task<Satelite?> ConsultarN2yoAsync(int noradId, string apiKey)
        {
            // Coordenadas del observador de referencia (Madrid: 40.4168, -3.7038, altitud 650m)
            var url = $"https://api.n2yo.com/rest/v1/satellite/positions/{noradId}/40.4168/-3.7038/650/1/?apiKey={apiKey}";
            var response = await _httpClient.GetAsync(url);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("positions", out var positions) || positions.GetArrayLength() == 0)
            {
                return null;
            }

            var pos = positions[0];
            var nombre = root.TryGetProperty("info", out var info) && info.TryGetProperty("satname", out var nameProp)
                ? nameProp.GetString() ?? $"Satélite {noradId}"
                : $"Satélite {noradId}";

            return new Satelite
            {
                NoradId = noradId,
                Nombre = nombre,
                Latitud = pos.TryGetProperty("satlatitude", out var latProp) ? latProp.GetDouble() : 0,
                Longitud = pos.TryGetProperty("satlongitude", out var lonProp) ? lonProp.GetDouble() : 0,
                AltitudKm = pos.TryGetProperty("sataltitude", out var altProp) ? Math.Round(altProp.GetDouble(), 2) : 0,
                VelocidadKmH = 27600,
                Visibilidad = "daylight",
                Timestamp = pos.TryGetProperty("timestamp", out var timeProp) ? timeProp.GetInt64() : DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            };
        }
    }
}

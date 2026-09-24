using Dharma.Models;
using System.Net.Http.Headers;
using System.Text.Json;

namespace Dharma.Services
{
    public class GestionAviones : IAviones
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;

        // Caché en memoria para reutilizar el token OAuth2 mientras sea válido (dura 30 min)
        private static string? _cachedToken;
        private static DateTime _tokenExpiration;

        public GestionAviones(HttpClient httpClient, IConfiguration configuration)
        {
            _httpClient = httpClient;
            _configuration = configuration;
        }

        /// <summary>
        /// Obtiene o renueva el token OAuth2 de OpenSky usando ClientId y ClientSecret
        /// </summary>
        private async Task<string?> ObtenerTokenAsync()
        {
            // Si el token en memoria todavía es válido, lo reutilizamos
            if (!string.IsNullOrEmpty(_cachedToken) && DateTime.UtcNow < _tokenExpiration)
            {
                return _cachedToken;
            }

            var clientId = _configuration["OpenSky:ClientId"];
            var clientSecret = _configuration["OpenSky:ClientSecret"];

            if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
            {
                return null;
            }

            // Petición POST OAuth2 con client_credentials
            var parametros = new Dictionary<string, string>
            {
                { "grant_type", "client_credentials" },
                { "client_id", clientId },
                { "client_secret", clientSecret }
            };

            var tokenUrl = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
            var request = new HttpRequestMessage(HttpMethod.Post, tokenUrl)
            {
                Content = new FormUrlEncodedContent(parametros)
            };

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            if (doc.RootElement.TryGetProperty("access_token", out var tokenProp))
            {
                _cachedToken = tokenProp.GetString();

                int expiresIn = 1800; // 30 minutos por defecto
                if (doc.RootElement.TryGetProperty("expires_in", out var expiresProp))
                {
                    expiresIn = expiresProp.GetInt32();
                }

                // Guardamos la fecha de expiración restando 60 segundos de margen de seguridad
                _tokenExpiration = DateTime.UtcNow.AddSeconds(expiresIn - 60);
                return _cachedToken;
            }

            return null;
        }

        /// <summary>
        /// Obtiene los aviones en tiempo real desde OpenSky (global o por región geográfica)
        /// </summary>
        public async Task<List<Avion>> ObtenerAvionesAsync(double? lamin = null, double? lomin = null, double? lamax = null, double? lomax = null)
        {
            var listaAviones = new List<Avion>();

            // 1. Obtenemos el token de autenticación
            var token = await ObtenerTokenAsync();

            // 2. Construimos la URL: si el mapa envía límites visibles, filtramos esa zona; si no, global
            var url = "https://opensky-network.org/api/states/all";
            if (lamin.HasValue && lomin.HasValue && lamax.HasValue && lomax.HasValue)
            {
                var cult = System.Globalization.CultureInfo.InvariantCulture;
                url += $"?lamin={lamin.Value.ToString(cult)}&lomin={lomin.Value.ToString(cult)}&lamax={lamax.Value.ToString(cult)}&lomax={lomax.Value.ToString(cult)}";
            }

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrEmpty(token))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            }

            var response = await _httpClient.SendAsync(request);

            // PLAN B AUTOMÁTICO:
            // Si la cuenta registrada ha agotado su cupo diario de 4.000 peticiones (HTTP 429) o el token da error,
            // reintentamos inmediatamente la misma petición en modo anónimo (sin enviar el token Bearer).
            // La cuota anónima es independiente y permite seguir viendo los vuelos de inmediato.
            if (!response.IsSuccessStatusCode && !string.IsNullOrEmpty(token))
            {
                var requestAnonima = new HttpRequestMessage(HttpMethod.Get, url);
                response = await _httpClient.SendAsync(requestAnonima);
            }

            // ESCALÓN 3:
            // Si OpenSky está bloqueado o agota su cuota por IP (HTTP 429),
            // recurrimos directamente a la red abierta comunitaria ADS-B (ADSB.fi) en tiempo real.
            if (!response.IsSuccessStatusCode)
            {
                return await ObtenerAvionesDesdeAdsbFiAsync(lamin, lomin, lamax, lomax);
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            // 3. Procesamos los aviones devueltos en la propiedad "states"
            if (doc.RootElement.TryGetProperty("states", out var statesProp) && statesProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var state in statesProp.EnumerateArray())
                {
                    if (state.GetArrayLength() > 8)
                    {
                        var avion = new Avion
                        {
                            Icao24 = state[0].GetString() ?? string.Empty,
                            Callsign = state[1].GetString()?.Trim() ?? string.Empty,
                            PaisOrigen = state[2].GetString() ?? string.Empty,
                            Longitud = state[5].ValueKind == JsonValueKind.Number ? state[5].GetDouble() : null,
                            Latitud = state[6].ValueKind == JsonValueKind.Number ? state[6].GetDouble() : null,
                            Altitud = state[7].ValueKind == JsonValueKind.Number ? state[7].GetDouble() : null,
                            EnTierra = state[8].ValueKind == JsonValueKind.True,
                            Velocidad = state.GetArrayLength() > 9 && state[9].ValueKind == JsonValueKind.Number
                                ? Math.Round(state[9].GetDouble() * 3.6, 1) // Convertimos m/s a km/h
                                : null,
                            Rumbo = state.GetArrayLength() > 10 && state[10].ValueKind == JsonValueKind.Number
                                ? Math.Round(state[10].GetDouble(), 1) // Rumbo en grados (0° a 360°)
                                : null,
                            TasaVertical = state.GetArrayLength() > 11 && state[11].ValueKind == JsonValueKind.Number
                                ? Math.Round(state[11].GetDouble(), 1) // m/s (ascenso / descenso)
                                : null,
                            // Código Squawk de 4 dígitos (Índice 14 del vector de OpenSky)
                            Squawk = state.GetArrayLength() > 14 && state[14].ValueKind == JsonValueKind.String
                                ? state[14].GetString()
                                : null
                        };

                        // Filtramos aviones que tengan datos identificativos o posición
                        if (!string.IsNullOrWhiteSpace(avion.Callsign) || avion.Latitud != null)
                        {
                            listaAviones.Add(avion);
                        }
                    }
                }
            }

            return listaAviones;
        }

        /// <summary>
        /// ESCALÓN 3: Red comunitaria abierta ADS-B (ADSB.fi) sin límite de cuota
        /// </summary>
        private async Task<List<Avion>> ObtenerAvionesDesdeAdsbFiAsync(double? lamin, double? lomin, double? lamax, double? lomax)
        {
            var lista = new List<Avion>();
            try
            {
                double lat = 40.4;
                double lon = -3.7;
                int dist = 250;

                if (lamin.HasValue && lamax.HasValue && lomin.HasValue && lomax.HasValue)
                {
                    lat = (lamin.Value + lamax.Value) / 2.0;
                    lon = (lomin.Value + lomax.Value) / 2.0;
                    dist = (int)Math.Max(25, Math.Min(250, ((lamax.Value - lamin.Value) / 2.0) * 60));
                }

                var cult = System.Globalization.CultureInfo.InvariantCulture;
                var url = $"https://opendata.adsb.fi/api/v2/lat/{lat.ToString(cult)}/lon/{lon.ToString(cult)}/dist/{dist}";

                var res = await _httpClient.GetAsync(url);
                if (!res.IsSuccessStatusCode) return lista;

                var json = await res.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);

                if (doc.RootElement.TryGetProperty("aircraft", out var acProp) && acProp.ValueKind == JsonValueKind.Array)
                {
                    foreach (var ac in acProp.EnumerateArray())
                    {
                        if (ac.TryGetProperty("lat", out var latProp) && ac.TryGetProperty("lon", out var lonProp))
                        {
                            var hexCode = ac.TryGetProperty("hex", out var h) ? h.GetString() ?? "" : "";
                            var regCode = ac.TryGetProperty("r", out var rProp) ? rProp.GetString()?.Trim() : null;

                            var avion = new Avion
                            {
                                Icao24 = hexCode,
                                Callsign = ac.TryGetProperty("flight", out var f) ? f.GetString()?.Trim() ?? "" : "",
                                PaisOrigen = DeterminarPais(regCode, hexCode),
                                Latitud = latProp.GetDouble(),
                                Longitud = lonProp.GetDouble(),
                                EnTierra = ac.TryGetProperty("alt_baro", out var ab) && ab.ValueKind == JsonValueKind.String && ab.GetString() == "ground",
                                Altitud = ac.TryGetProperty("alt_baro", out var altB) && altB.ValueKind == JsonValueKind.Number 
                                    ? Math.Round(altB.GetDouble() * 0.3048) : null,
                                Velocidad = ac.TryGetProperty("gs", out var gsProp) && gsProp.ValueKind == JsonValueKind.Number 
                                    ? Math.Round(gsProp.GetDouble() * 1.852) : null,
                                Rumbo = ac.TryGetProperty("track", out var trProp) && trProp.ValueKind == JsonValueKind.Number 
                                    ? Math.Round(trProp.GetDouble(), 1) : null,
                                TasaVertical = ac.TryGetProperty("baro_rate", out var brProp) && brProp.ValueKind == JsonValueKind.Number
                                    ? Math.Round(brProp.GetDouble() * 0.00508, 1) : null,
                                Squawk = ac.TryGetProperty("squawk", out var sqProp) ? sqProp.GetString() : null
                            };

                            if (!string.IsNullOrWhiteSpace(avion.Callsign) || !string.IsNullOrWhiteSpace(avion.Icao24))
                            {
                                lista.Add(avion);
                            }
                        }
                    }
                }
            }
            catch
            {
                // En caso de fallo de red devuelve lista vacía
            }

            return lista;
        }

        /// <summary>
        /// Determina el país de registro de la aeronave a partir de su matrícula (prefijo OACI) o bloque de código hex.
        /// </summary>
        private static string DeterminarPais(string? registro, string? hex)
        {
            if (!string.IsNullOrWhiteSpace(registro))
            {
                var reg = registro.Trim().ToUpperInvariant();
                if (reg.StartsWith("EC-")) return "España";
                if (reg.StartsWith("G-") || reg.StartsWith("2-")) return "Reino Unido";
                if (reg.StartsWith("F-")) return "Francia";
                if (reg.StartsWith("D-")) return "Alemania";
                if (reg.StartsWith("I-")) return "Italia";
                if (reg.StartsWith("CS-") || reg.StartsWith("CR-")) return "Portugal";
                if (reg.StartsWith("PH-")) return "Países Bajos";
                if (reg.StartsWith("OO-")) return "Bélgica";
                if (reg.StartsWith("EI-") || reg.StartsWith("EJ-")) return "Irlanda";
                if (reg.StartsWith("OE-")) return "Austria";
                if (reg.StartsWith("HB-")) return "Suiza";
                if (reg.StartsWith("SE-")) return "Suecia";
                if (reg.StartsWith("LN-")) return "Noruega";
                if (reg.StartsWith("OY-")) return "Dinamarca";
                if (reg.StartsWith("OH-")) return "Finlandia";
                if (reg.StartsWith("SX-")) return "Grecia";
                if (reg.StartsWith("TC-")) return "Turquía";
                if (reg.StartsWith("N")) return "Estados Unidos";
                if (reg.StartsWith("C-")) return "Canadá";
                if (reg.StartsWith("A6-")) return "Emiratos Árabes";
                if (reg.StartsWith("A7-")) return "Catar";
                if (reg.StartsWith("SP-")) return "Polonia";
                if (reg.StartsWith("9H-")) return "Malta";
                if (reg.StartsWith("9A-")) return "Croacia";
                if (reg.StartsWith("HA-")) return "Hungría";
                if (reg.StartsWith("OM-")) return "Eslovaquia";
                if (reg.StartsWith("OK-")) return "República Checa";
                if (reg.StartsWith("CN-")) return "Marruecos";
                if (reg.StartsWith("7T-")) return "Argelia";
                if (reg.StartsWith("TS-")) return "Túnez";
                if (reg.StartsWith("4X-")) return "Israel";
                if (reg.StartsWith("SU-")) return "Egipto";
                if (reg.StartsWith("B-")) return "China";
                if (reg.StartsWith("JA")) return "Japón";
                if (reg.StartsWith("VH-")) return "Australia";
                if (reg.StartsWith("CC-")) return "Chile";
                if (reg.StartsWith("LV-")) return "Argentina";
                if (reg.StartsWith("PP-") || reg.StartsWith("PR-") || reg.StartsWith("PT-") || reg.StartsWith("PS-")) return "Brasil";
                if (reg.StartsWith("XA-") || reg.StartsWith("XB-") || reg.StartsWith("XC-")) return "México";
                if (reg.StartsWith("HK-")) return "Colombia";
                if (reg.StartsWith("YV-")) return "Venezuela";
                if (reg.StartsWith("CP-")) return "Bolivia";
                if (reg.StartsWith("TG-")) return "Guatemala";
                if (reg.StartsWith("TI-")) return "Costa Rica";
                if (reg.StartsWith("HP-")) return "Panamá";
                if (reg.StartsWith("VP-B") || reg.StartsWith("VQ-B")) return "Bermudas";
                if (reg.StartsWith("P4-")) return "Aruba";
                if (reg.StartsWith("M-")) return "Isla de Man";
                if (reg.StartsWith("LZ-")) return "Bulgaria";
                if (reg.StartsWith("YR-")) return "Rumanía";
                if (reg.StartsWith("YL-")) return "Letonia";
                if (reg.StartsWith("ES-")) return "Estonia";
                if (reg.StartsWith("LY-")) return "Lituania";
                if (reg.StartsWith("RA-")) return "Rusia";
                if (reg.StartsWith("UR-")) return "Ucrania";
                if (reg.StartsWith("HZ-")) return "Arabia Saudí";
                if (reg.StartsWith("VT-")) return "India";
                if (reg.StartsWith("HL")) return "Corea del Sur";
                if (reg.StartsWith("ZK-")) return "Nueva Zelanda";
                if (reg.StartsWith("ZS-")) return "Sudáfrica";
            }

            if (!string.IsNullOrWhiteSpace(hex) && hex.Length >= 2)
            {
                var h = hex.Trim().ToUpperInvariant();
                if (h.StartsWith("34")) return "España";
                if (h.StartsWith("40") || h.StartsWith("41") || h.StartsWith("42") || h.StartsWith("43")) return "Reino Unido";
                if (h.StartsWith("38") || h.StartsWith("39") || h.StartsWith("3A")) return "Francia";
                if (h.StartsWith("3C") || h.StartsWith("3D") || h.StartsWith("3E") || h.StartsWith("3F")) return "Alemania";
                if (h.StartsWith("30") || h.StartsWith("31") || h.StartsWith("32") || h.StartsWith("33")) return "Italia";
                if (h.StartsWith("49")) return "Portugal";
                if (h.StartsWith("48")) return "Países Bajos";
                if (h.StartsWith("44")) return "Austria";
                if (h.StartsWith("4CA") || h.StartsWith("4CB")) return "Irlanda";
                if (h.StartsWith("4B")) return "Turquía";
                if (h.StartsWith("4D2")) return "Malta";
                if (h.StartsWith("45")) return "Dinamarca";
                if (h.StartsWith("46")) return "Suecia";
                if (h.StartsWith("47")) return "Noruega";
                if (h.StartsWith("896")) return "Emiratos Árabes";
                if (h.StartsWith("A")) return "Estados Unidos";
                if (h.StartsWith("C0") || h.StartsWith("C1") || h.StartsWith("C2")) return "Canadá";
                if (h.StartsWith("E4")) return "Brasil";
            }

            return "Internacional";
        }
    }
}

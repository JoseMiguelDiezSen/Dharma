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
        /// Obtiene los aviones en tiempo real desde OpenSky
        /// </summary>
        public async Task<List<Avion>> ObtenerAvionesAsync()
        {
            var listaAviones = new List<Avion>();

            // 1. Obtenemos el token de autenticación
            var token = await ObtenerTokenAsync();

            // 2. Filtramos por el espacio aéreo de España/Península para una respuesta rápida
            var url = "https://opensky-network.org/api/states/all?lamin=35.0&lomin=-10.0&lamax=44.5&lomax=4.5";

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrEmpty(token))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            }

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return listaAviones;
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
    }
}

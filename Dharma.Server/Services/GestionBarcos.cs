using Dharma.Models;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace Dharma.Services
{
    public class GestionBarcos : BackgroundService, IBarcos
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<GestionBarcos> _logger;

        // Almacén en memoria concurrente para las embarcaciones activas (clave: MMSI)
        private readonly ConcurrentDictionary<string, Barco> _barcos = new();

        // Control de envío seguro sobre el WebSocket
        private readonly SemaphoreSlim _sendLock = new(1, 1);
        private ClientWebSocket? _webSocket;

        // Bounding box actual suscrito (por defecto España, Estrecho, Baleares y Canarias)
        private double _currentLamin = 27.0;
        private double _currentLomin = -19.0;
        private double _currentLamax = 45.0;
        private double _currentLomax = 5.0;

        public GestionBarcos(IConfiguration configuration, ILogger<GestionBarcos> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        /// <summary>
        /// Devuelve los barcos en memoria. Si se pasan coordenadas, filtra dentro de esa caja.
        /// Además, si la caja solicitada difiere de la suscrita, actualiza la suscripción en caliente.
        /// </summary>
        public Task<List<Barco>> ObtenerBarcosAsync(double? lamin = null, double? lomin = null, double? lamax = null, double? lomax = null)
        {
            if (lamin.HasValue && lomin.HasValue && lamax.HasValue && lomax.HasValue)
            {
                // Si la nueva vista se sale de los márgenes actuales, actualizamos la suscripción en background
                _ = ComprobarYActualizarSuscripcionAsync(lamin.Value, lomin.Value, lamax.Value, lomax.Value);

                var filtrados = _barcos.Values
                    .Where(b => b.Latitud >= lamin.Value && b.Latitud <= lamax.Value &&
                                b.Longitud >= lomin.Value && b.Longitud <= lomax.Value)
                    .OrderByDescending(b => b.UltimaActualizacion)
                    .ToList();

                return Task.FromResult(filtrados);
            }

            var todos = _barcos.Values
                .OrderByDescending(b => b.UltimaActualizacion)
                .ToList();

            return Task.FromResult(todos);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Servicio GestionBarcos iniciado.");

            // Tarea secundaria para purgar barcos inactivos cada 5 minutos
            _ = IniciarLimpiezaPeriodicaAsync(stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var apiKey = _configuration["AISStream:ApiKey"];
                    if (string.IsNullOrEmpty(apiKey))
                    {
                        _logger.LogWarning("No se configuró AISStream:ApiKey en appsettings.json. Reintentando en 15s...");
                        await Task.Delay(15000, stoppingToken);
                        continue;
                    }

                    using (_webSocket = new ClientWebSocket())
                    {
                        _logger.LogInformation("Conectando con AISStream WebSocket...");
                        await _webSocket.ConnectAsync(new Uri("wss://stream.aisstream.io/v0/stream"), stoppingToken);
                        _logger.LogInformation("Conectado con éxito a AISStream.");

                        // Enviamos la suscripción inicial
                        await EnviarSuscripcionAsync(_currentLamin, _currentLomin, _currentLamax, _currentLomax, stoppingToken);

                        var buffer = new byte[8192];
                        var ms = new MemoryStream();

                        while (_webSocket.State == WebSocketState.Open && !stoppingToken.IsCancellationRequested)
                        {
                            var result = await _webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), stoppingToken);

                            if (result.MessageType == WebSocketMessageType.Close)
                            {
                                await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Cerrando", stoppingToken);
                                break;
                            }

                            ms.Write(buffer, 0, result.Count);

                            if (result.EndOfMessage)
                            {
                                ms.Seek(0, SeekOrigin.Begin);
                                var json = Encoding.UTF8.GetString(ms.ToArray());
                                ms.SetLength(0);

                                ProcesarMensajeAis(json);
                            }
                        }
                    }
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error en la conexión WebSocket de AISStream. Reintentando en 5 segundos...");
                }

                if (!stoppingToken.IsCancellationRequested)
                {
                    await Task.Delay(5000, stoppingToken);
                }
            }
        }

        private async Task EnviarSuscripcionAsync(double lamin, double lomin, double lamax, double lomax, CancellationToken ct)
        {
            if (_webSocket == null || _webSocket.State != WebSocketState.Open) return;

            var apiKey = _configuration["AISStream:ApiKey"];
            var suscripcion = new
            {
                APIKey = apiKey,
                BoundingBoxes = new double[][][]
                {
                    new double[][]
                    {
                        new double[] { lamin, lomin },
                        new double[] { lamax, lomax }
                    }
                },
                FilterMessageTypes = new[] { "PositionReport", "ShipStaticData", "StandardClassBPositionReport" }
            };

            var jsonBytes = JsonSerializer.SerializeToUtf8Bytes(suscripcion);

            await _sendLock.WaitAsync(ct);
            try
            {
                if (_webSocket.State == WebSocketState.Open)
                {
                    await _webSocket.SendAsync(new ArraySegment<byte>(jsonBytes), WebSocketMessageType.Text, true, ct);
                    _logger.LogInformation("Suscripción AISStream actualizada para área: [{Lamin},{Lomin}] a [{Lamax},{Lomax}]", lamin, lomin, lamax, lomax);
                }
            }
            finally
            {
                _sendLock.Release();
            }
        }

        private async Task ComprobarYActualizarSuscripcionAsync(double lamin, double lomin, double lamax, double lomax)
        {
            // Solo actualizamos si el usuario ha desplazado notablemente el área (más de 1 grado)
            if (Math.Abs(_currentLamin - lamin) > 1.0 || Math.Abs(_currentLomin - lomin) > 1.0 ||
                Math.Abs(_currentLamax - lamax) > 1.0 || Math.Abs(_currentLomax - lomax) > 1.0)
            {
                _currentLamin = lamin;
                _currentLomin = lomin;
                _currentLamax = lamax;
                _currentLomax = lomax;

                try
                {
                    await EnviarSuscripcionAsync(lamin, lomin, lamax, lomax, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "No se pudo actualizar la suscripción dinámica de AISStream.");
                }
            }
        }

        private void ProcesarMensajeAis(string json)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                if (!root.TryGetProperty("MessageType", out var msgTypeProp)) return;
                var messageType = msgTypeProp.GetString();

                if (!root.TryGetProperty("MetaData", out var metaData)) return;

                // Extraemos MMSI
                string? mmsi = null;
                if (metaData.TryGetProperty("MMSI", out var mmsiProp))
                {
                    mmsi = mmsiProp.ToString();
                }
                if (string.IsNullOrEmpty(mmsi)) return;

                var barco = _barcos.GetOrAdd(mmsi, id =>
                {
                    var nuevo = new Barco { Mmsi = id };
                    var (pais, bandera) = ObtenerPaisYBandera(id);
                    nuevo.Pais = pais;
                    nuevo.Bandera = bandera;
                    return nuevo;
                });

                // Nombre en MetaData
                if (metaData.TryGetProperty("ShipName", out var shipNameProp))
                {
                    var nombre = shipNameProp.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(nombre))
                    {
                        barco.Nombre = nombre;
                    }
                }

                // Coordenadas en MetaData
                if (metaData.TryGetProperty("latitude", out var latProp) && latProp.TryGetDouble(out var lat))
                {
                    barco.Latitud = lat;
                }
                else if (metaData.TryGetProperty("Latitude", out var latProp2) && latProp2.TryGetDouble(out var lat2))
                {
                    barco.Latitud = lat2;
                }

                if (metaData.TryGetProperty("longitude", out var lonProp) && lonProp.TryGetDouble(out var lon))
                {
                    barco.Longitud = lon;
                }
                else if (metaData.TryGetProperty("Longitude", out var lonProp2) && lonProp2.TryGetDouble(out var lon2))
                {
                    barco.Longitud = lon2;
                }

                barco.UltimaActualizacion = DateTime.UtcNow;

                if (!root.TryGetProperty("Message", out var msgObj)) return;

                if (messageType == "PositionReport" && msgObj.TryGetProperty("PositionReport", out var posReport))
                {
                    if (posReport.TryGetProperty("Sog", out var sogProp) && sogProp.TryGetDouble(out var sog))
                    {
                        barco.Velocidad = sog;
                    }
                    if (posReport.TryGetProperty("Cog", out var cogProp) && cogProp.TryGetDouble(out var cog))
                    {
                        barco.Rumbo = cog;
                    }
                    else if (posReport.TryGetProperty("TrueHeading", out var thProp) && thProp.TryGetDouble(out var th) && th < 360)
                    {
                        barco.Rumbo = th;
                    }
                    if (posReport.TryGetProperty("NavigationalStatus", out var navProp) && navProp.TryGetInt32(out var navStatus))
                    {
                        barco.EstadoNav = ObtenerDescripcionEstadoNav(navStatus);
                    }
                }
                else if (messageType == "StandardClassBPositionReport" && msgObj.TryGetProperty("StandardClassBPositionReport", out var bReport))
                {
                    if (bReport.TryGetProperty("Sog", out var sogProp) && sogProp.TryGetDouble(out var sog))
                    {
                        barco.Velocidad = sog;
                    }
                    if (bReport.TryGetProperty("Cog", out var cogProp) && cogProp.TryGetDouble(out var cog))
                    {
                        barco.Rumbo = cog;
                    }
                    else if (bReport.TryGetProperty("TrueHeading", out var thProp) && thProp.TryGetDouble(out var th) && th < 360)
                    {
                        barco.Rumbo = th;
                    }
                }
                else if (messageType == "ShipStaticData" && msgObj.TryGetProperty("ShipStaticData", out var staticData))
                {
                    if (staticData.TryGetProperty("Name", out var nameProp))
                    {
                        var name = nameProp.GetString()?.Trim();
                        if (!string.IsNullOrEmpty(name)) barco.Nombre = name;
                    }
                    if (staticData.TryGetProperty("CallSign", out var csProp))
                    {
                        barco.Callsign = csProp.GetString()?.Trim();
                    }
                    if (staticData.TryGetProperty("Destination", out var destProp))
                    {
                        var dest = destProp.GetString()?.Trim();
                        if (!string.IsNullOrEmpty(dest)) barco.Destino = dest;
                    }
                    if (staticData.TryGetProperty("ImoNumber", out var imoProp) && imoProp.TryGetInt64(out var imo) && imo > 0)
                    {
                        barco.Imo = imo.ToString();
                    }
                    if (staticData.TryGetProperty("Type", out var typeProp) && typeProp.TryGetInt32(out var tipo))
                    {
                        barco.Tipo = tipo;
                        barco.TipoDescripcion = ObtenerDescripcionTipo(tipo);
                    }
                    if (staticData.TryGetProperty("Dimension", out var dimProp))
                    {
                        double a = 0, b = 0, c = 0, d = 0;
                        if (dimProp.TryGetProperty("A", out var ap) && ap.TryGetDouble(out var av)) a = av;
                        if (dimProp.TryGetProperty("B", out var bp) && bp.TryGetDouble(out var bv)) b = bv;
                        if (dimProp.TryGetProperty("C", out var cp) && cp.TryGetDouble(out var cv)) c = cv;
                        if (dimProp.TryGetProperty("D", out var dp) && dp.TryGetDouble(out var dv)) d = dv;

                        if (a + b > 0) barco.Eslora = a + b;
                        if (c + d > 0) barco.Manga = c + d;
                    }
                    if (staticData.TryGetProperty("MaximumStaticDraught", out var drProp) && drProp.TryGetDouble(out var calado))
                    {
                        barco.Calado = calado;
                    }
                }
            }
            catch
            {
                // Descartamos mensajes incompletos sin frenar el flujo
            }
        }

        private async Task IniciarLimpiezaPeriodicaAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(TimeSpan.FromMinutes(5), ct);
                    var limite = DateTime.UtcNow.AddMinutes(-20);

                    foreach (var kvp in _barcos)
                    {
                        if (kvp.Value.UltimaActualizacion < limite)
                        {
                            _barcos.TryRemove(kvp.Key, out _);
                        }
                    }
                }
                catch
                {
                    // Ignorado en apagado
                }
            }
        }

        private static (string Pais, string Bandera) ObtenerPaisYBandera(string mmsi)
        {
            if (string.IsNullOrEmpty(mmsi) || mmsi.Length < 3) return ("Desconocido", "🌐");

            var mid = mmsi.Substring(0, 3);
            return mid switch
            {
                "224" or "225" => ("España", "🇪🇸"),
                "226" or "227" or "228" => ("Francia", "🇫🇷"),
                "247" => ("Italia", "🇮🇹"),
                "255" => ("Portugal", "🇵🇹"),
                "232" or "233" or "234" or "235" => ("Reino Unido", "🇬🇧"),
                "211" => ("Alemania", "🇩🇪"),
                "244" or "245" or "246" => ("Países Bajos", "🇳🇱"),
                "205" => ("Bélgica", "🇧🇪"),
                "219" or "220" => ("Dinamarca", "🇩🇰"),
                "257" or "258" or "259" => ("Noruega", "🇳🇴"),
                "265" or "266" => ("Suecia", "🇸🇪"),
                "230" => ("Finlandia", "🇫🇮"),
                "237" or "239" or "240" or "241" => ("Grecia", "🇬🇷"),
                "271" => ("Turquía", "🇹🇷"),
                "242" => ("Marruecos", "🇲🇦"),
                "201" => ("Argelia", "🇩🇿"),
                "256" => ("Malta", "🇲🇹"),
                "209" or "210" or "212" => ("Chipre", "🇨🇾"),
                "351" or "352" or "353" or "354" or "355" or "356" or "357" or "370" or "371" or "372" or "373" => ("Panamá", "🇵🇦"),
                "636" => ("Liberia", "🇱🇷"),
                "538" => ("Islas Marshall", "🇲🇭"),
                "311" => ("Bahamas", "🇧🇸"),
                "366" or "367" or "368" or "369" => ("Estados Unidos", "🇺🇸"),
                "412" or "413" or "414" => ("China", "🇨🇳"),
                _ => ("Internacional", "🌐")
            };
        }

        private static string ObtenerDescripcionTipo(int tipo)
        {
            return tipo switch
            {
                >= 20 and <= 29 => "Especial / WIG",
                30 => "Pesquero",
                31 or 32 => "Remolcador",
                36 or 37 => "Embarcación de Recreo / Velero",
                >= 40 and <= 49 => "Embarcación Rápida (HSC)",
                >= 50 and <= 59 => "Servicio / Prácticos",
                >= 60 and <= 69 => "Pasaje / Ferry",
                >= 70 and <= 79 => "Carguero",
                >= 80 and <= 89 => "Petrolero / Quimiquero",
                _ => "Embarcación"
            };
        }

        private static string ObtenerDescripcionEstadoNav(int estado)
        {
            return estado switch
            {
                0 => "En navegación a motor",
                1 => "Fondeado",
                2 => "Sin gobierno",
                3 => "Maniobrabilidad restringida",
                4 => "Restringido por su calado",
                5 => "Amarrado / Atracado",
                6 => "Varado",
                7 => "Dedicado a la pesca",
                8 => "En navegación a vela",
                _ => "En navegación"
            };
        }
    }
}

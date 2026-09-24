import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import * as L from 'leaflet';

@Component({
    selector: 'app-aviones',
    templateUrl: './aviones.component.html',
    styleUrls: ['./aviones.component.css'],
    standalone: false
})
export class AvionesComponent implements OnInit, AfterViewInit, OnDestroy {

  // Título de la pantalla (mantenemos tu título personalizado)
  titulo: string = 'Vuelos en Tiempo Real';

  // Lista de aviones devueltos por el backend
  aviones: any[] = [];

  // Avión seleccionado para mostrar la ficha flotante de detalles
  avionSeleccionado: any = null;

  // Detalles ampliados del vuelo seleccionado (modelo, origen/destino, matrícula, foto)
  detallesVuelo: any = null;
  cargandoDetalles: boolean = false;

  // Filtro de búsqueda por código de vuelo
  filtroVuelo: string = '';

  // Indicador de carga
  cargando: boolean = false;

  // Control para mostrar u ocultar la tabla flotante
  mostrarTabla: boolean = false;

  // Control de auto-refresco en vivo: encendido por defecto
  autoRefresco: boolean = true;
  private intervaloRefresco: any = null;
  private debounceTimer: any = null;

  // Estado del visor 3D (Cesium)
  modo3D: boolean = false;
  cargando3D: boolean = false;
  private cesiumModule: any = null;
  private cesiumViewer: any = null;
  private cesiumCargado: boolean = false;
  private cesiumClickHandler: any = null;

  // Instancia del mapa Leaflet y mapa de marcadores para actualización suave
  private map: L.Map | null = null;
  private markersMap = new Map<string, L.Marker>();

  // Notificaciones de tráfico en vivo para el Aeropuerto Adolfo Suárez Madrid-Barajas (LEMD)
  notificacionesBarajas: Array<{ id: string; tipo: 'llegada' | 'salida'; avion: any; mensaje: string }> = [];
  private vuelosNotificadosBarajas = new Set<string>();
  private readonly BARAJAS_LAT = 40.4719;
  private readonly BARAJAS_LON = -3.5626;

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    this.inicializarMapaRadar();
    this.iniciarAutoRefresco();
  }

  ngOnDestroy(): void {
    if (this.intervaloRefresco) {
      clearInterval(this.intervaloRefresco);
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.map) {
      this.map.remove();
    }
    if (this.cesiumClickHandler) {
      this.cesiumClickHandler.destroy();
      this.cesiumClickHandler = null;
    }
    if (this.cesiumViewer && !this.cesiumViewer.isDestroyed()) {
      this.cesiumViewer.destroy();
      this.cesiumViewer = null;
    }
  }

  // Inicializa el mapa con la capa oscura de Radar profesional Esri (SIN MARCAS DE AGUA)
  private inicializarMapaRadar(): void {
    // Posición inicial: España completa centrada (Península y Baleares con encuadre óptimo)
    this.map = L.map('mapa-aviones', {
      zoomControl: false, // Quitamos controles en pantalla
      minZoom: 3,         // Limita el zoom out para que el mapa nunca se duplique
      maxBounds: [[-85, -180], [85, 180]], // Límites del globo terráqueo
      maxBoundsViscosity: 1.0              // Rebote rígido sin deriva a zonas vacías
    }).setView([40.2, -3.6], 6);

    // Controles de zoom en pantalla desactivados (zoom disponible por rueda del ratón y gesto táctil)

    // 1. Capa de Radar Oscuro Esri (sin marcas de agua)
    const radarOscuro = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16,
      attribution: '&copy; Esri'
    });

    // 2. Capa Satélite real de alta resolución (sin marcas de agua)
    const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: '&copy; Esri'
    });

    // Añadimos el radar oscuro por defecto
    radarOscuro.addTo(this.map);

    // Selector flotante abajo a la izquierda para cambiar entre Radar Oscuro y Satélite
    L.control.layers({
      'Radar Oscuro': radarOscuro,
      'Satélite': satelite
    }, undefined, { position: 'bottomleft' }).addTo(this.map);

    // Al arrastrar o hacer zoom, recargamos los vuelos de la zona visible (con margen de 700ms)
    this.map.on('moveend', () => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.obtenerAviones();
      }, 700);
    });

    // Carga inicial
    this.obtenerAviones();
  }

  // Obtiene los aviones visibles en el área actual del mapa
  obtenerAviones(): void {
    // Si ya hay una petición en curso, no saturamos el canal
    if (this.cargando) return;
    this.cargando = true;

    let params = new HttpParams();

    // 1. Modo 3D (Cesium): Calculamos el cuadrante visible en el globo terráqueo
    if (this.modo3D && this.cesiumViewer && this.cesiumModule) {
      const Cesium = this.cesiumModule;
      const rect = this.cesiumViewer.camera.computeViewRectangle(this.cesiumViewer.scene.globe.ellipsoid);
      if (rect) {
        let south = Math.max(-85, Math.min(85, Cesium.Math.toDegrees(rect.south)));
        let north = Math.max(-85, Math.min(85, Cesium.Math.toDegrees(rect.north)));
        let west = Math.max(-180, Math.min(180, Cesium.Math.toDegrees(rect.west)));
        let east = Math.max(-180, Math.min(180, Cesium.Math.toDegrees(rect.east)));

        if (south < north && west < east) {
          params = params
            .set('lamin', south.toFixed(3))
            .set('lomin', west.toFixed(3))
            .set('lamax', north.toFixed(3))
            .set('lomax', east.toFixed(3));
        }
      } else {
        // Si la cámara está muy inclinada hacia el horizonte, calculamos según el punto central del suelo
        const canvas = this.cesiumViewer.scene.canvas;
        const ray = this.cesiumViewer.camera.getPickRay(new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2));
        const cartesian = this.cesiumViewer.scene.globe.pick(ray, this.cesiumViewer.scene);
        if (cartesian) {
          const carto = Cesium.Cartographic.fromCartesian(cartesian);
          const cLat = Cesium.Math.toDegrees(carto.latitude);
          const cLon = Cesium.Math.toDegrees(carto.longitude);
          const south = Math.max(-85, cLat - 12);
          const north = Math.min(85, cLat + 12);
          const west = Math.max(-180, cLon - 15);
          const east = Math.min(180, cLon + 15);
          if (south < north && west < east) {
            params = params
              .set('lamin', south.toFixed(3))
              .set('lomin', west.toFixed(3))
              .set('lamax', north.toFixed(3))
              .set('lomax', east.toFixed(3));
          }
        }
      }
    } else if (this.map) {
      // 2. Modo 2D (Leaflet)
      const bounds = this.map.getBounds();
      const south = Math.max(-85, bounds.getSouth());
      const north = Math.min(85, bounds.getNorth());
      const west = Math.max(-180, bounds.getWest());
      const east = Math.min(180, bounds.getEast());

      if (south < north && west < east) {
        params = params
          .set('lamin', south.toFixed(3))
          .set('lomin', west.toFixed(3))
          .set('lamax', north.toFixed(3))
          .set('lomax', east.toFixed(3));
      }
    }

    this.http.get<any[]>('/api/Aviones', { params })
      .subscribe({
        next: (data) => {
          // Limitamos a 250 vuelos en pantalla para garantizar máxima fluidez
          const vuelos = (data || []).slice(0, 250);
          for (const avion of vuelos) {
            avion.aerolinea = this.obtenerAerolinea(avion.callsign);
            avion.tipoAeronave = this.obtenerTipoAeronave(avion);
          }
          this.aviones = vuelos;
          this.cargando = false;
          this.actualizarMarcadoresSuaves();
          if (this.modo3D) {
            this.actualizarMarcadoresCesium();
          }
          this.procesarTraficoBarajas(vuelos);

          // Si hay un avión seleccionado, actualizamos sus datos en vivo
          if (this.avionSeleccionado) {
            const actualizado = this.aviones.find(a => a.icao24 === this.avionSeleccionado.icao24);
            if (actualizado) {
              this.avionSeleccionado = actualizado;
            }
          }
        },
        error: (err) => {
          console.error('Error al obtener aviones de OpenSky:', err);
          this.cargando = false;
        }
      });
  }

  // Actualiza los aviones en el mapa sin destruir marcadores (evita parpadeos)
  private actualizarMarcadoresSuaves(): void {
    if (!this.map) return;

    const idsRecibidos = new Set<string>();

    for (const avion of this.aviones) {
      if (avion.latitud != null && avion.longitud != null) {
        idsRecibidos.add(avion.icao24);
        const rumbo = avion.rumbo ?? 0;
        const esEmergencia = avion.squawk === '7700' || avion.squawk === '7500';
        const esFalloRadio = avion.squawk === '7600';

        // Identificación de tipo, color aeronáutico y tamaño
        const tipo = avion.tipoAeronave || this.obtenerTipoAeronave(avion);
        const color = this.obtenerColorAeronave(avion, tipo);
        const tamano = this.obtenerTamanoAeronave(tipo);
        const viewBox = tipo === 'avion_grande' ? '0 0 32 32' : '0 0 24 24';
        const innerSvg = this.obtenerContenidoSvg(tipo, color);

        // Silueta SVG según tipo de aeronave (avión, grande, avioneta, helicóptero), rotada al rumbo
        const svgIcon = `
          <div style="transform: rotate(${rumbo}deg); width: ${tamano}px; height: ${tamano}px; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="${viewBox}" width="${tamano}" height="${tamano}" style="filter: drop-shadow(0 0 ${esEmergencia ? '8px rgba(239,68,68,1)' : (avion.enTierra ? '4px rgba(0,0,0,0.5)' : '4px ' + color + '99')});">
              ${innerSvg}
            </svg>
          </div>
        `;

        const customIcon = L.divIcon({
          className: esEmergencia ? 'marcador-avion-radar avion-emergencia' : 'marcador-avion-radar',
          html: svgIcon,
          iconSize: [tamano, tamano],
          iconAnchor: [tamano / 2, tamano / 2]
        });

        if (this.markersMap.has(avion.icao24)) {
          // El avión ya existe: actualizamos su posición y su rumbo suavemente
          const marker = this.markersMap.get(avion.icao24)!;
          marker.setLatLng([avion.latitud, avion.longitud]);
          marker.setIcon(customIcon);
        } else {
          // Avión nuevo: creamos su marcador y evento de clic
          const marker = L.marker([avion.latitud, avion.longitud], { icon: customIcon });
          marker.on('click', () => {
            this.seleccionarAvion(avion);
          });
          marker.addTo(this.map);
          this.markersMap.set(avion.icao24, marker);
        }
      }
    }

    // Eliminamos los marcadores de aviones que hayan salido de la pantalla
    for (const [id, marker] of this.markersMap.entries()) {
      if (!idsRecibidos.has(id)) {
        marker.remove();
        this.markersMap.delete(id);
      }
    }
  }

  // Selecciona un avión y consulta su modelo, ruta y foto
  seleccionarAvion(avion: any): void {
    this.avionSeleccionado = avion;
    this.detallesVuelo = null;
    this.cargarDetallesAvion(avion);
  }

  // Cierra la tarjeta flotante de detalles
  cerrarDetalle(): void {
    this.avionSeleccionado = null;
    this.detallesVuelo = null;
  }

  // Consulta la ruta (origen/destino) y ficha técnica del avión (modelo, fabricante, matrícula y foto)
  private cargarDetallesAvion(avion: any): void {
    this.cargandoDetalles = true;
    const detalles: any = {};
    const icao = avion.icao24?.toLowerCase();
    const callsign = avion.callsign?.trim();

    // 1. Consultar modelo del avión y matrícula en la base de datos aeronáutica
    if (icao) {
      this.http.get<any>(`https://api.adsbdb.com/v0/aircraft/${icao}`)
        .subscribe({
          next: (res) => {
            const ac = res?.response?.aircraft;
            if (ac) {
              detalles.modelo = ac.type || ac.icao_type;
              detalles.fabricante = ac.manufacturer;
              detalles.matricula = ac.registration;
              detalles.foto = ac.url_photo_thumbnail || ac.url_photo;
              this.detallesVuelo = { ...this.detallesVuelo, ...detalles };
            }
          },
          error: () => {}
        });
    }

    // 2. Consultar ruta (Origen y Destino) por código de vuelo
    if (callsign) {
      this.http.get<any>(`https://api.adsbdb.com/v0/callsign/${callsign}`)
        .subscribe({
          next: (res) => {
            const fr = res?.response?.flightroute;
            if (fr) {
              detalles.origenCiudad = fr.origin?.municipality || fr.origin?.country_name;
              detalles.origenIata = fr.origin?.iata_code || fr.origin?.icao_code;
              detalles.origenNombre = fr.origin?.name;
              detalles.origenLat = fr.origin?.latitude;
              detalles.origenLon = fr.origin?.longitude;

              detalles.destinoCiudad = fr.destination?.municipality || fr.destination?.country_name;
              detalles.destinoIata = fr.destination?.iata_code || fr.destination?.icao_code;
              detalles.destinoNombre = fr.destination?.name;
              detalles.destinoLat = fr.destination?.latitude;
              detalles.destinoLon = fr.destination?.longitude;
              this.detallesVuelo = { ...this.detallesVuelo, ...detalles };
            }
            this.cargandoDetalles = false;
          },
          error: () => {
            this.cargandoDetalles = false;
          }
        });
    } else {
      this.cargandoDetalles = false;
    }
  }

  // Centra la cámara del mapa en un avión concreto (Zoom 11 en 2D o perspectiva 3D)
  centrarEnAvion(avion: any): void {
    if (avion.latitud != null && avion.longitud != null) {
      this.seleccionarAvion(avion);
      if (this.modo3D && this.cesiumViewer) {
        this.centrarEnAvionCesium(avion);
      } else if (this.map) {
        this.map.flyTo([avion.latitud, avion.longitud], 11, { duration: 1.2 });
      }
    }
  }

  // Alterna el auto-refresco
  alternarAutoRefresco(): void {
    this.autoRefresco = !this.autoRefresco;
    if (this.autoRefresco) {
      this.iniciarAutoRefresco();
    } else {
      if (this.intervaloRefresco) {
        clearInterval(this.intervaloRefresco);
        this.intervaloRefresco = null;
      }
    }
  }

  private iniciarAutoRefresco(): void {
    if (this.intervaloRefresco) {
      clearInterval(this.intervaloRefresco);
    }
    this.intervaloRefresco = setInterval(() => {
      this.obtenerAviones();
    }, 5000); // Refresco automático en vivo cada 5 segundos
  }

  // Alterna la visibilidad de la tabla flotante
  alternarTabla(): void {
    this.mostrarTabla = !this.mostrarTabla;
  }

  // Filtra aviones en la tabla o búsqueda por código, país o nombre de aerolínea
  get avionesFiltrados(): any[] {
    let lista = this.aviones;
    if (this.filtroVuelo) {
      const q = this.filtroVuelo.toUpperCase().trim();
      lista = this.aviones.filter(a => 
        (a.callsign && a.callsign.toUpperCase().includes(q)) || 
        (a.icao24 && a.icao24.toUpperCase().includes(q)) ||
        (a.paisOrigen && a.paisOrigen.toUpperCase().includes(q)) ||
        (a.aerolinea && a.aerolinea.toUpperCase().includes(q))
      );
    }
    return lista.slice(0, 100);
  }

  // Identifica el nombre comercial de la compañía aérea según el prefijo oficial ICAO del vuelo
  obtenerAerolinea(callsign: string): string {
    if (!callsign || callsign.trim().length < 3) return 'Aviación General';
    const prefijo = callsign.trim().substring(0, 3).toUpperCase();
    const aerolineas: { [key: string]: string } = {
      'IBE': 'Iberia',
      'IBS': 'Iberia Express',
      'RYR': 'Ryanair',
      'RUK': 'Ryanair UK',
      'VLG': 'Vueling Airlines',
      'AEA': 'Air Europa',
      'ANE': 'Air Nostrum',
      'VOE': 'Volotea',
      'EZY': 'easyJet',
      'EZS': 'easyJet Switzerland',
      'EJU': 'easyJet Europe',
      'AFR': 'Air France',
      'BAW': 'British Airways',
      'DLH': 'Lufthansa',
      'KLM': 'KLM',
      'TAP': 'TAP Air Portugal',
      'SWR': 'Swiss International',
      'THY': 'Turkish Airlines',
      'AUA': 'Austrian Airlines',
      'SAS': 'Scandinavian Airlines',
      'EIN': 'Aer Lingus',
      'FIN': 'Finnair',
      'WZZ': 'Wizz Air',
      'WMT': 'Wizz Air Malta',
      'WUK': 'Wizz Air UK',
      'TRA': 'Transavia',
      'TVF': 'Transavia France',
      'EXS': 'Jet2.com',
      'TUI': 'TUI Airways',
      'TOM': 'TUI Airways',
      'JAF': 'TUI fly Belgium',
      'BEL': 'Brussels Airlines',
      'ITA': 'ITA Airways',
      'AZA': 'Alitalia',
      'BTI': 'airBaltic',
      'UAE': 'Emirates',
      'QTR': 'Qatar Airways',
      'ETD': 'Etihad Airways',
      'DAL': 'Delta Air Lines',
      'AAL': 'American Airlines',
      'UAL': 'United Airlines',
      'ACA': 'Air Canada',
      'AMX': 'Aeroméxico',
      'LAN': 'LATAM Airlines',
      'ARG': 'Aerolíneas Argentinas',
      'AVA': 'Avianca',
      'TAM': 'LATAM Brasil',
      'SVA': 'Saudia',
      'RAM': 'Royal Air Maroc',
      'TAR': 'Tunisair',
      'SIA': 'Singapore Airlines',
      'CPA': 'Cathay Pacific',
      'ANA': 'All Nippon Airways',
      'JAL': 'Japan Airlines',
      'CCA': 'Air China',
      'CES': 'China Eastern',
      'CSN': 'China Southern',
      'FDX': 'FedEx Express',
      'UPS': 'UPS Airlines',
      'DHL': 'DHL Aviation',
      'BCS': 'European Air Transport (DHL)',
      'SWT': 'Swiftair',
      'GES': 'Gestair',
      'AME': 'Ejército del Aire (España)',
      'BAF': 'Fuerza Aérea Belga',
      'FAF': 'Ejército del Aire Francés',
      'GAF': 'Fuerza Aérea Alemana',
      'RRR': 'Royal Air Force',
      'RCH': 'US Air Force',
      'CNV': 'US Navy'
    };
    return aerolineas[prefijo] || 'Vuelo Privado / Chárter';
  }

  // Devuelve la lista de aviones en situación de emergencia actualmente visibles en pantalla
  get vuelosEmergencia(): any[] {
    return this.aviones.filter(a => a.squawk === '7700' || a.squawk === '7500' || a.squawk === '7600');
  }

  // Resumen dinámico de vuelos visibles agrupados por aerolínea (top 8, color distintivo)
  get resumenAerolineas(): { nombre: string; total: number; color: string; texto: string }[] {
    const conteo = new Map<string, number>();
    for (const avion of this.aviones) {
      const nombre = avion.aerolinea === 'Vuelo Privado / Chárter' ? 'Vuelo Privado' : (avion.aerolinea || 'Desconocida');
      conteo.set(nombre, (conteo.get(nombre) || 0) + 1);
    }
    return [...conteo.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nombre, total]) => {
        const color = this.colorDeAerolinea(nombre);
        return { nombre, total, color, texto: this.esColorClaro(color) ? '#111827' : '#ffffff' };
      });
  }

  // Color distintivo por aerolínea (compañías conocidas) con paleta de repuesto estable
  private colorDeAerolinea(nombre: string): string {
    const colores: { [key: string]: string } = {
      'Iberia': '#d81f26',
      'Iberia Express': '#d81f26',
      'Ryanair': '#f4c20d',
      'Ryanair UK': '#f4c20d',
      'Vueling Airlines': '#f9a602',
      'Air Europa': '#e4002b',
      'Air Nostrum': '#7f1818',
      'Volotea': '#f5b01e',
      'easyJet': '#ff6b1a',
      'easyJet Switzerland': '#ff6b1a',
      'easyJet Europe': '#ff6b1a',
      'Air France': '#002c84',
      'British Airways': '#3f8abf',
      'Lufthansa': '#f7d117',
      'KLM': '#00a1de',
      'TAP Air Portugal': '#eab308',
      'Swiss International': '#e3032e',
      'Turkish Airlines': '#1464a1',
      'Austrian Airlines': '#cf0816',
      'Scandinavian Airlines': '#2d3a5c',
      'Aer Lingus': '#008000',
      'Finnair': '#003580',
      'Wizz Air': '#c6007e',
      'Wizz Air Malta': '#c6007e',
      'Wizz Air UK': '#c6007e',
      'Transavia': '#173a5f',
      'Transavia France': '#173a5f',
      'TUI Airways': '#001c3d',
      'TUI fly Belgium': '#001c3d',
      'Jet2.com': '#ee202e',
      'Emirates': '#d71921',
      'Qatar Airways': '#750b1c',
      'Etihad Airways': '#294d73',
      'Delta Air Lines': '#7f1421',
      'American Airlines': '#0078d2',
      'United Airlines': '#002244',
      'Air Canada': '#e8112d',
      'FedEx Express': '#4d148c',
      'UPS Airlines': '#ffb500',
      'DHL Aviation': '#ffc600',
      'European Air Transport (DHL)': '#ffc600',
      'Vuelo Privado': '#94a3b8',
      'Aviación General': '#64748b'
    };
    if (colores[nombre]) return colores[nombre];

    const paleta = ['#38bdf8', '#f59e0b', '#a78bfa', '#22c55e', '#f472b6', '#2dd4bf', '#fb923c', '#818cf8', '#facc15', '#f87171'];
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
      hash = (hash + nombre.charCodeAt(i)) % paleta.length;
    }
    return paleta[hash];
  }

  // Determina si un color es claro para elegir texto oscuro o claro con buen contraste
  private esColorClaro(hex: string): boolean {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
  }

  // Traduce el código Squawk de emergencia a un texto claro
  obtenerTextoEmergencia(squawk: string): string {
    if (squawk === '7700') return 'EMERGENCIA GENERAL (MAYDAY)';
    if (squawk === '7600') return 'FALLO DE RADIO / COMUNICACIONES';
    if (squawk === '7500') return 'INTERFERENCIA ILÍCITA / SECUESTRO';
    return '';
  }

  // Procesa aviones en el entorno de Barajas (< 35 km y < 3.800 m) para emitir aviso
  private procesarTraficoBarajas(vuelos: any[]): void {
    for (const avion of vuelos) {
      if (!avion.latitud || !avion.longitud) continue;

      const dist = this.calcularDistanciaKm(this.BARAJAS_LAT, this.BARAJAS_LON, avion.latitud, avion.longitud);

      // Si está en el espacio de Barajas (< 35 km) y a cota baja (< 3.800 m o en tierra)
      const enZonaBarajas = dist <= 35 && (avion.enTierra || (avion.altitud != null && avion.altitud <= 3800));

      if (enZonaBarajas) {
        const idVuelo = avion.callsign || avion.icao24;
        if (!idVuelo || this.vuelosNotificadosBarajas.has(idVuelo)) continue;

        // Detección inicial por telemetría (ascenso/descenso y vector de aproximación)
        const esSalida = this.esSalidaDeBarajas(avion);
        const tipo: 'llegada' | 'salida' = esSalida ? 'salida' : 'llegada';
        const mensaje = tipo === 'llegada' ? 'Aproximación a LEMD' : 'Salida de LEMD';

        const nuevaNotif: { id: string; tipo: 'llegada' | 'salida'; avion: any; mensaje: string } = {
          id: idVuelo,
          tipo,
          avion,
          mensaje
        };

        // Consultamos la ruta real para confirmar origen y destino exactos
        if (avion.callsign) {
          this.http.get<any>(`https://api.adsbdb.com/v0/callsign/${avion.callsign.trim()}`)
            .subscribe({
              next: (res) => {
                const fr = res?.response?.flightroute;
                if (fr) {
                  const destCode = fr.destination?.iata_code || fr.destination?.icao_code;
                  const origCode = fr.origin?.iata_code || fr.origin?.icao_code;

                  // Si el destino es Madrid (MAD / LEMD) -> Confirmado LLEGADA
                  if (destCode === 'MAD' || destCode === 'LEMD') {
                    nuevaNotif.tipo = 'llegada';
                    const ciudad = fr.origin?.municipality || fr.origin?.country_name || fr.origin?.name || 'Origen desconocido';
                    nuevaNotif.mensaje = `Origen: ${ciudad}${origCode ? ' (' + origCode + ')' : ''}`;
                  }
                  // Si el origen es Madrid (MAD / LEMD) -> Confirmado SALIDA
                  else if (origCode === 'MAD' || origCode === 'LEMD') {
                    nuevaNotif.tipo = 'salida';
                    const ciudad = fr.destination?.municipality || fr.destination?.country_name || fr.destination?.name || 'Destino desconocido';
                    nuevaNotif.mensaje = `Destino: ${ciudad}${destCode ? ' (' + destCode + ')' : ''}`;
                  }
                }
              },
              error: () => {}
            });
        }

        this.vuelosNotificadosBarajas.add(idVuelo);

        // Cupos equilibrados: máximo 2 llegadas y 2 salidas simultáneas (las salidas nunca expulsan llegadas)
        const delMismoTipo = this.notificacionesBarajas.filter(n => n.tipo === nuevaNotif.tipo);
        if (delMismoTipo.length >= 2) {
          const masAntigua = delMismoTipo[0];
          this.notificacionesBarajas = this.notificacionesBarajas.filter(n => n !== masAntigua);
        }
        this.notificacionesBarajas.push(nuevaNotif);

        // Desvanecimiento suave a los 12 segundos para dar tiempo a verlas y pulsar
        setTimeout(() => {
          this.cerrarNotificacion(nuevaNotif);
        }, 12000);
      }
    }

    // Control de memoria del histórico
    if (this.vuelosNotificadosBarajas.size > 200) {
      this.vuelosNotificadosBarajas.clear();
    }
  }

  // Cierra una notificación manual o automáticamente
  cerrarNotificacion(notif: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.notificacionesBarajas = this.notificacionesBarajas.filter(n => n !== notif);
  }

  // Fórmula Haversine para cálculo de distancia en kilómetros
  private calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Calcula el porcentaje dinámico de vuelo completado (de 2% a 98%)
  get progresoVuelo(): number | null {
    if (!this.avionSeleccionado || !this.detallesVuelo) return null;
    const { origenLat, origenLon, destinoLat, destinoLon } = this.detallesVuelo;
    const { latitud, longitud } = this.avionSeleccionado;

    if (origenLat == null || origenLon == null || destinoLat == null || destinoLon == null || latitud == null || longitud == null) {
      return null;
    }

    const distOrigen = this.calcularDistanciaKm(origenLat, origenLon, latitud, longitud);
    const distDestino = this.calcularDistanciaKm(latitud, longitud, destinoLat, destinoLon);
    const distTotal = distOrigen + distDestino;

    if (distTotal <= 0) return null;

    const porcentaje = Math.round((distOrigen / distTotal) * 100);
    return Math.max(2, Math.min(98, porcentaje));
  }

  // Determina si un avión vuela alejándose de Barajas (Salida) o acercándose (Llegada)
  private esSalidaDeBarajas(avion: any): boolean {
    // 1. Tasa vertical: ascenso = salida, descenso = llegada
    if (avion.tasaVertical != null && avion.tasaVertical > 0.5) return true;
    if (avion.tasaVertical != null && avion.tasaVertical < -0.3) return false;

    // 2. Vector angular: Comprobamos si su rumbo apunta hacia afuera de Barajas
    if (avion.rumbo != null && avion.latitud != null && avion.longitud != null) {
      const dLat = avion.latitud - this.BARAJAS_LAT;
      const dLon = avion.longitud - this.BARAJAS_LON;
      let anguloHaciaAfuera = (Math.atan2(dLon, dLat) * 180 / Math.PI);
      if (anguloHaciaAfuera < 0) anguloHaciaAfuera += 360;

      let dif = Math.abs(avion.rumbo - anguloHaciaAfuera);
      if (dif > 180) dif = 360 - dif;

      // Si la diferencia entre su rumbo y el vector hacia afuera es < 85°, se aleja (salida)
      return dif < 85;
    }

    return false;
  }

  // Alterna entre la vista 2D (Leaflet) y el globo 3D (Cesium)
  async alternarModo3D(): Promise<void> {
    this.modo3D = !this.modo3D;
    if (this.modo3D) {
      if (!this.cesiumCargado) {
        this.cargando3D = true;
        try {
          (window as any).CESIUM_BASE_URL = '/assets/cesium/';
          await this.cargarScriptCesium();
          this.cesiumModule = (window as any).Cesium;
          this.cesiumCargado = true;
          await this.inicializarCesium();
        } catch (error) {
          console.error('Error al inicializar Cesium 3D:', error);
          this.modo3D = false;
        } finally {
          this.cargando3D = false;
        }
      } else if (this.cesiumViewer) {
        this.cesiumViewer.useDefaultRenderLoop = true;
      }
      if (this.cesiumViewer && this.cesiumModule) {
        if (this.avionSeleccionado) {
          this.centrarEnAvionCesium(this.avionSeleccionado);
        } else if (this.map) {
          const center = this.map.getCenter();
          this.cesiumViewer.camera.flyTo({
            destination: this.cesiumModule.Cartesian3.fromDegrees(center.lng, center.lat, 2500000),
            duration: 1.2
          });
        }
        this.actualizarMarcadoresCesium();
        // Recargar aviones del área 3D enfocada tras el vuelo de cámara
        setTimeout(() => this.obtenerAviones(), 1300);
      }
    } else {
      // Pausar bucle WebGL de Cesium para 0% uso de GPU mientras estemos en 2D
      if (this.cesiumViewer) {
        this.cesiumViewer.useDefaultRenderLoop = false;
        // Sincronizar el centro del mapa 2D con el punto donde miraba la cámara en 3D
        if (this.cesiumModule && this.map) {
          const canvas = this.cesiumViewer.scene.canvas;
          const ray = this.cesiumViewer.camera.getPickRay(new this.cesiumModule.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2));
          const cartesian = this.cesiumViewer.scene.globe.pick(ray, this.cesiumViewer.scene);
          if (cartesian) {
            const carto = this.cesiumModule.Cartographic.fromCartesian(cartesian);
            this.map.setView([this.cesiumModule.Math.toDegrees(carto.latitude), this.cesiumModule.Math.toDegrees(carto.longitude)], this.map.getZoom(), { animate: false });
          }
        }
      }
      if (this.map) {
        setTimeout(() => {
          this.map?.invalidateSize();
          this.obtenerAviones();
        }, 100);
      }
    }
  }

  // Inicializa el globo 3D con tema oscuro y eventos
  private async inicializarCesium(): Promise<void> {
    const Cesium = this.cesiumModule;
    // Anula peticiones remotas a Cesium Ion para evitar bloqueos y esperas
    Cesium.Ion.defaultAccessToken = '';

    this.cesiumViewer = new Cesium.Viewer('cesium-container', {
      baseLayer: false, // Evita la carga por defecto de Bing/Ion que provocaba el timeout
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      scene3DOnly: true,
      shouldAnimate: true
    });

    // Capa base oscura Esri Canvas Dark (a juego con el radar 2D)
    const esriDarkProvider = new Cesium.UrlTemplateImageryProvider({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      maximumLevel: 16,
      credit: 'Esri'
    });
    this.cesiumViewer.imageryLayers.removeAll();
    this.cesiumViewer.imageryLayers.addImageryProvider(esriDarkProvider);

    // Fondo y atmósfera oscura
    if (this.cesiumViewer.scene.skyBox) {
      this.cesiumViewer.scene.skyBox.show = false;
    }
    this.cesiumViewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0b0f19');
    this.cesiumViewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0b0f19');

    // Selección por clic en 3D
    const handler = new Cesium.ScreenSpaceEventHandler(this.cesiumViewer.scene.canvas);
    handler.setInputAction((movement: any) => {
      const pickedObject = this.cesiumViewer.scene.pick(movement.position);
      if (Cesium.defined(pickedObject) && pickedObject.id) {
        const icao24 = pickedObject.id.id;
        const avion = this.aviones.find(a => a.icao24 === icao24);
        if (avion) {
          this.seleccionarAvion(avion);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    this.cesiumClickHandler = handler;

    // Al mover, rotar o hacer zoom en el globo 3D, recargamos los vuelos de la zona visible
    this.cesiumViewer.camera.moveEnd.addEventListener(() => {
      if (!this.modo3D) return;
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.obtenerAviones();
      }, 700);
    });
  }

  // Actualiza las posiciones y rumbos de las aeronaves en el espacio 3D
  private actualizarMarcadoresCesium(): void {
    if (!this.cesiumViewer || !this.modo3D || !this.cesiumModule) return;
    const Cesium = this.cesiumModule;
    const idsRecibidos = new Set<string>();

    for (const avion of this.aviones) {
      if (avion.latitud != null && avion.longitud != null) {
        idsRecibidos.add(avion.icao24);
        const altitud = avion.altitud != null ? avion.altitud : (avion.enTierra ? 50 : 3000);
        const position = Cesium.Cartesian3.fromDegrees(avion.longitud, avion.latitud, altitud);
        const rumbo = avion.rumbo ?? 0;
        const tipo = avion.tipoAeronave || this.obtenerTipoAeronave(avion);
        const colorHex = this.obtenerColorAeronave(avion, tipo);
        const tamano = this.obtenerTamanoAeronave(tipo);
        const svgDataUri = this.generarSvgAeronave(tipo, colorHex);

        let entity = this.cesiumViewer.entities.getById(avion.icao24);
        if (entity) {
          entity.position = position;
          if (entity.billboard) {
            entity.billboard.rotation = Cesium.Math.toRadians(-rumbo);
            entity.billboard.image = svgDataUri;
          }
        } else {
          this.cesiumViewer.entities.add({
            id: avion.icao24,
            name: avion.callsign || avion.icao24,
            position: position,
            billboard: {
              image: svgDataUri,
              rotation: Cesium.Math.toRadians(-rumbo),
              width: tamano,
              height: tamano,
              scaleByDistance: new Cesium.NearFarScalar(1.0e3, 1.2, 6.0e6, 0.7)
            },
            label: {
              text: avion.callsign || avion.icao24,
              font: '10px monospace',
              fillColor: Cesium.Color.fromCssColorString(colorHex),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, -22),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 1500000.0)
            }
          });
        }
      }
    }

    // Limpieza de entidades que salieron del radar
    const entitiesToRemove: any[] = [];
    const entities = this.cesiumViewer.entities.values;
    for (let i = 0; i < entities.length; i++) {
      const ent = entities[i];
      if (!idsRecibidos.has(ent.id)) {
        entitiesToRemove.push(ent);
      }
    }
    for (const ent of entitiesToRemove) {
      this.cesiumViewer.entities.remove(ent);
    }
  }

  // Clasifica la aeronave según indicativo, aerolínea y envolvente de vuelo
  obtenerTipoAeronave(avion: any): 'helicoptero' | 'avion_grande' | 'avioneta' | 'avion' {
    const cs = (avion.callsign || '').toUpperCase().trim();
    const vel = avion.velocidad ?? 0;
    const alt = avion.altitud ?? 0;

    // 1. Helicópteros (servicios de emergencias, policía, DGT, o prefijos reconocidos)
    if (cs.startsWith('HELI') || cs.startsWith('DGT') || cs.startsWith('CUCO') || 
        cs.startsWith('ANGEL') || cs.startsWith('HELM') || cs.startsWith('SUMMA') || 
        cs.startsWith('061') || cs.startsWith('MEDIC') || cs.startsWith('HEMS') ||
        cs.startsWith('BHK') || cs.startsWith('INR')) {
      return 'helicoptero';
    }

    // 2. Aviones grandes / Heavy (vuelos de largo radio o flotas de fuselaje ancho)
    const aerolineasHeavy = ['UAE', 'QTR', 'ETD', 'SIA', 'CPA', 'CCA', 'CES', 'CSN'];
    const esPrefijoHeavy = aerolineasHeavy.some(p => cs.startsWith(p));
    const esIberiaLargoRadio = cs.startsWith('IBE6') || cs.startsWith('IB6');
    const esAirEuropaLargoRadio = cs.startsWith('AEA0') || cs.startsWith('UX0');
    if (esPrefijoHeavy || esIberiaLargoRadio || esAirEuropaLargoRadio || (alt > 11500 && vel > 860)) {
      return 'avion_grande';
    }

    // 3. Avionetas / Aviación Ligera (matrículas privadas o escuelas a baja cota y velocidad)
    const aerolinea = avion.aerolinea || '';
    const esVueloPrivado = aerolinea.includes('Privado') || aerolinea.includes('General');
    const pareceMatricula = cs.startsWith('EC-') || (cs.startsWith('N') && cs.length <= 6);
    if ((pareceMatricula || esVueloPrivado) && vel > 0 && vel < 320 && alt < 3800) {
      return 'avioneta';
    }

    // 4. Avión comercial estándar
    return 'avion';
  }

  // Color específico según tipo y estado de emergencia
  private obtenerColorAeronave(avion: any, tipo: string): string {
    if (avion.squawk === '7700' || avion.squawk === '7500') return '#ef4444';
    if (avion.squawk === '7600') return '#f97316';
    if (avion.enTierra) return '#94a3b8';

    switch (tipo) {
      case 'helicoptero': return '#06b6d4';
      case 'avion_grande': return '#fbbf24';
      case 'avioneta': return '#34d399';
      default: return '#f59e0b';
    }
  }

  // Tamaño de marcador adaptado a la envergadura de la aeronave
  private obtenerTamanoAeronave(tipo: string): number {
    switch (tipo) {
      case 'avion_grande': return 34;
      case 'avioneta': return 22;
      case 'helicoptero': return 28;
      default: return 28;
    }
  }

  // Contenido interno SVG para cada una de las 4 siluetas aeronáuticas
  private obtenerContenidoSvg(tipo: string, color: string): string {
    switch (tipo) {
      case 'avion_grande':
        return `<path fill="${color}" d="M16 1.5c-1 0-1.8.8-1.8 2.2V11L2 17.5v3.2l12.2-2.8V25l-4 2.8V30.5l5.8-1.6 5.8 1.6V27.8L17.8 25V17.9L30 20.7V17.5L17.8 11V3.7c0-1.4-.8-2.2-1.8-2.2z"/><circle cx="9" cy="16.5" r="1.2" fill="${color}"/><circle cx="12" cy="15" r="1.2" fill="${color}"/><circle cx="23" cy="16.5" r="1.2" fill="${color}"/><circle cx="20" cy="15" r="1.2" fill="${color}"/>`;
      case 'avioneta':
        return `<path fill="${color}" d="M12 2c-.55 0-1 .45-1 1.2V7H1.5c-.55 0-1 .45-1 1s.45 1 1 1H11v8.5H6.5c-.55 0-1 .45-1 1s.45 1 1 1H10l.5 2h3l.5-2h3.5c.55 0 1-.45 1-1s-.45-1-1-1H13V9h9.5c.55 0 1-.45 1-1s-.45-1-1-1H13V3.2c0-.75-.45-1.2-1-1.2z"/><ellipse cx="12" cy="2" rx="3.5" ry="0.7" fill="${color}" opacity="0.75"/>`;
      case 'helicoptero':
        return `<path fill="${color}" d="M11 2.5v3.2A4.2 4.2 0 0 0 8 9.5c0 2.1 1.4 3.8 3.2 4.2V19.5l-2.2 1.2v1.5l3-1 3 1v-1.5l-2.2-1.2v-5.8A4.2 4.2 0 0 0 16 9.5a4.2 4.2 0 0 0-3-3.8V2.5h-2z"/><circle cx="12" cy="9.5" r="1.8" fill="#ffffff" opacity="0.9"/><line x1="12" y1="1" x2="12" y2="18" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/><line x1="3.5" y1="9.5" x2="20.5" y2="9.5" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/><line x1="10" y1="21.5" x2="14" y2="21.5" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/>`;
      default:
        return `<path fill="${color}" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>`;
    }
  }

  // Genera el SVG completo en Data URI para el billboard de Cesium 3D
  private generarSvgAeronave(tipo: string, color: string): string {
    const viewBox = tipo === 'avion_grande' ? '0 0 32 32' : '0 0 24 24';
    const tamano = this.obtenerTamanoAeronave(tipo);
    const inner = this.obtenerContenidoSvg(tipo, color);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${tamano}" height="${tamano}">${inner}</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // Centra y sigue la aeronave en el espacio 3D
  private centrarEnAvionCesium(avion: any): void {
    if (!this.cesiumViewer || !avion.latitud || !avion.longitud || !this.cesiumModule) return;
    const Cesium = this.cesiumModule;
    const altitud = avion.altitud != null ? avion.altitud : (avion.enTierra ? 50 : 3000);
    this.cesiumViewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(avion.longitud, avion.latitud - 0.15, altitud + 15000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-40),
        roll: 0.0
      },
      duration: 1.5
    });
  }

  // Carga dinámica del bundle oficial de Cesium bajo demanda
  private cargarScriptCesium(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).Cesium) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = '/assets/cesium/Cesium.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    });
  }

}


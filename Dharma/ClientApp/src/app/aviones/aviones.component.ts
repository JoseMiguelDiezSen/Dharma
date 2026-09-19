import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import * as L from 'leaflet';

@Component({
  selector: 'app-aviones',
  templateUrl: './aviones.component.html',
  styleUrls: ['./aviones.component.css']
})
export class AvionesComponent implements OnInit, AfterViewInit, OnDestroy {

  // Título de la pantalla (mantenemos tu título personalizado)
  titulo: string = 'Vuelos en Tiempo Real by JSM';

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

  // Instancia del mapa Leaflet y mapa de marcadores para actualización suave
  private map: L.Map | null = null;
  private markersMap = new Map<string, L.Marker>();

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
  }

  // Inicializa el mapa con la capa oscura de Radar profesional Esri (SIN MARCAS DE AGUA)
  private inicializarMapaRadar(): void {
    // Abrimos la vista a toda Europa y países vecinos de entrada
    this.map = L.map('mapa-aviones', {
      zoomControl: false // Quitamos los controles estándar para ponerlos flotantes
    }).setView([48.0, 5.0], 4);

    // Controles de zoom abajo a la derecha
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

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

    // Filtramos siempre por las coordenadas exactas que el usuario tiene en pantalla
    if (this.map) {
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
          }
          this.aviones = vuelos;
          this.cargando = false;
          this.actualizarMarcadoresSuaves();

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

        // Rojo brillante para emergencia (7700/7500), naranja para fallo de radio (7600), gris tierra o ámbar normal
        const color = esEmergencia ? '#ef4444' : (esFalloRadio ? '#f97316' : (avion.enTierra ? '#94a3b8' : '#f59e0b'));

        // Silueta SVG aeronáutica estilizada y rotada (con sombra roja si está en emergencia)
        const svgIcon = `
          <div style="transform: rotate(${rumbo}deg); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" width="26" height="26" style="filter: drop-shadow(0 0 ${esEmergencia ? '8px rgba(239,68,68,1)' : (avion.enTierra ? '4px rgba(0,0,0,0.5)' : '4px rgba(245,158,11,0.85)')});">
              <path fill="${color}" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
          </div>
        `;

        const customIcon = L.divIcon({
          className: esEmergencia ? 'marcador-avion-radar avion-emergencia' : 'marcador-avion-radar',
          html: svgIcon,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
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
              detalles.destinoCiudad = fr.destination?.municipality || fr.destination?.country_name;
              detalles.destinoIata = fr.destination?.iata_code || fr.destination?.icao_code;
              detalles.destinoNombre = fr.destination?.name;
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

  // Centra la cámara del mapa en un avión concreto
  centrarEnAvion(avion: any): void {
    if (this.map && avion.latitud != null && avion.longitud != null) {
      this.map.flyTo([avion.latitud, avion.longitud], 8, { duration: 1.2 });
      this.seleccionarAvion(avion);
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
    }, 15000); // Refresco automático en vivo cada 15 segundos
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

  // Traduce el código Squawk de emergencia a un texto claro
  obtenerTextoEmergencia(squawk: string): string {
    if (squawk === '7700') return 'EMERGENCIA GENERAL (MAYDAY)';
    if (squawk === '7600') return 'FALLO DE RADIO / COMUNICACIONES';
    if (squawk === '7500') return 'INTERFERENCIA ILÍCITA / SECUESTRO';
    return '';
  }

}

import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import * as L from 'leaflet';

@Component({
    selector: 'app-barcos',
    templateUrl: './barcos.component.html',
    styleUrls: ['./barcos.component.css'],
    standalone: false
})
export class BarcosComponent implements OnInit, AfterViewInit, OnDestroy {

  // Título de la pantalla
  titulo: string = 'Tráfico Marítimo en Tiempo Real';

  // Lista de embarcaciones devueltas por el backend
  barcos: any[] = [];

  // Barco seleccionado para mostrar la ficha flotante de detalles
  barcoSeleccionado: any = null;
  datosEnriquecidos: any = null;

  // Filtro de búsqueda por nombre, MMSI o país
  filtroBarco: string = '';

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

  // Resumen de tipos de buques para el carrusel del HUD
  resumenTipos: Array<{ nombre: string; total: number; color: string; texto: string }> = [];

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    console.log('Componente Barcos cargado');
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

  // Inicializa el mapa centrado en España y el Estrecho de Gibraltar
  private inicializarMapaRadar(): void {
    this.map = L.map('mapa-barcos', {
      zoomControl: false,
      minZoom: 3,
      maxBounds: [[-85, -180], [85, 180]],
      maxBoundsViscosity: 1.0
    }).setView([37.0, -4.5], 6);

    // 1. Capa de Radar Oscuro Esri
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Esri, HERE, Garmin',
      maxZoom: 16
    }).addTo(this.map);

    // 2. Capa de Referencia (etiquetas de puertos, costas y ciudades)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      attribution: '',
      maxZoom: 16,
      opacity: 0.75
    }).addTo(this.map);

    // Al mover o hacer zoom en el mapa, pedimos los barcos de la nueva área
    this.map.on('moveend', () => {
      this.solicitarBarcosConDebounce();
    });

    // Petición inicial
    this.obtenerBarcos();
  }

  // Auto-refresco periódico
  iniciarAutoRefresco(): void {
    this.intervaloRefresco = setInterval(() => {
      if (this.autoRefresco && !this.cargando) {
        this.obtenerBarcos();
      }
    }, 5000);
  }

  alternarAutoRefresco(): void {
    this.autoRefresco = !this.autoRefresco;
  }

  // Evita saturar peticiones si el usuario arrastra el mapa continuamente
  private solicitarBarcosConDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.obtenerBarcos();
    }, 350);
  }

  // Consulta el endpoint /api/Barcos enviando la caja de coordenadas visible
  obtenerBarcos(): void {
    let params = new HttpParams();

    if (this.map) {
      const bounds = this.map.getBounds();
      params = params
        .set('lamin', bounds.getSouth().toString())
        .set('lomin', bounds.getWest().toString())
        .set('lamax', bounds.getNorth().toString())
        .set('lomax', bounds.getEast().toString());
    }

    this.cargando = true;
    this.http.get<any[]>('/api/Barcos', { params }).subscribe({
      next: (data) => {
        this.barcos = data || [];
        this.actualizarMarcadores();
        this.actualizarResumenTipos();

        // Si hay un barco seleccionado, actualizamos su telemetría en vivo
        if (this.barcoSeleccionado) {
          const actualizado = this.barcos.find(b => b.mmsi === this.barcoSeleccionado.mmsi);
          if (actualizado) {
            this.barcoSeleccionado = actualizado;
            this.datosEnriquecidos = this.obtenerDatosEnriquecidos(actualizado);
          }
        }
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al obtener barcos:', err);
        this.cargando = false;
      }
    });
  }

  // Actualiza o inserta los marcadores SVG de los barcos en Leaflet
  private actualizarMarcadores(): void {
    if (!this.map) return;

    const mmsiActivos = new Set<string>();

    for (const barco of this.barcos) {
      if (barco.latitud == null || barco.longitud == null) continue;

      const id = barco.mmsi;
      mmsiActivos.add(id);

      const rumbo = barco.rumbo != null ? barco.rumbo : 0;
      const color = this.obtenerColorTipo(barco.tipo);
      const htmlIcono = this.crearSvgBarco(rumbo, color);

      const icono = L.divIcon({
        className: 'marcador-barco-radar',
        html: htmlIcono,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      if (this.markersMap.has(id)) {
        const marker = this.markersMap.get(id)!;
        marker.setLatLng([barco.latitud, barco.longitud]);
        marker.setIcon(icono);
      } else {
        const marker = L.marker([barco.latitud, barco.longitud], { icon: icono }).addTo(this.map);
        marker.on('click', () => {
          this.seleccionarBarco(barco);
        });
        this.markersMap.set(id, marker);
      }
    }

    // Retiramos los barcos que ya no estén en la vista
    for (const [id, marker] of this.markersMap.entries()) {
      if (!mmsiActivos.has(id)) {
        this.map.removeLayer(marker);
        this.markersMap.delete(id);
      }
    }
  }

  // Genera el SVG del barco orientado según su rumbo náutico
  private crearSvgBarco(rumbo: number, color: string): string {
    return `
      <div style="transform: rotate(${rumbo}deg); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; transition: transform 0.4s linear;">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="${color}" stroke="#0b0f19" stroke-width="1.2">
          <!-- Silueta náutica apuntando al norte (0°) -->
          <path d="M12 2 L19 14 L16 22 L12 20 L8 22 L5 14 Z"/>
        </svg>
      </div>
    `;
  }

  // Color distintivo según el tipo de buque
  obtenerColorTipo(tipo?: number): string {
    if (tipo == null) return '#38bdf8'; // Azul cielo por defecto
    if (tipo === 30) return '#06b6d4'; // Pesquero (Cian)
    if (tipo === 31 || tipo === 32) return '#10b981'; // Remolcador (Verde)
    if (tipo === 36 || tipo === 37) return '#a855f7'; // Recreo / Velero (Púrpura)
    if (tipo >= 60 && tipo <= 69) return '#3b82f6'; // Pasaje / Ferries (Azul)
    if (tipo >= 70 && tipo <= 79) return '#f59e0b'; // Cargueros (Ámbar)
    if (tipo >= 80 && tipo <= 89) return '#ef4444'; // Petroleros / Quimiqueros (Rojo)
    return '#38bdf8';
  }

  // Agrupación para el carrusel de categorías en el HUD superior
  private actualizarResumenTipos(): void {
    const conteo = new Map<string, { total: number; color: string }>();

    for (const b of this.barcos) {
      const tipoDesc = b.tipoDescripcion || 'Embarcación';
      const actual = conteo.get(tipoDesc) || { total: 0, color: this.obtenerColorTipo(b.tipo) };
      actual.total++;
      conteo.set(tipoDesc, actual);
    }

    this.resumenTipos = Array.from(conteo.entries())
      .map(([nombre, data]) => ({
        nombre,
        total: data.total,
        color: data.color,
        texto: '#ffffff'
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }

  seleccionarBarco(barco: any): void {
    this.barcoSeleccionado = barco;
    this.datosEnriquecidos = this.obtenerDatosEnriquecidos(barco);
  }

  cerrarDetalle(): void {
    this.barcoSeleccionado = null;
    this.datosEnriquecidos = null;
  }

  // Obtiene datos enriquecidos del barco seleccionado (naviera, capacidad, puerto y progreso)
  obtenerDatosEnriquecidos(barco: any): any {
    if (!barco) return null;

    const naviera = this.detectarNaviera(barco.nombre, barco.tipo);
    const capacidad = this.estimarCapacidad(barco);
    const puerto = this.decodificarPuerto(barco.destino);
    const navegacion = this.calcularProgresoNautico(barco, puerto);

    return { naviera, capacidad, puerto, navegacion };
  }

  // 1. Detector inteligente de Navieras y Operadores comerciales
  detectarNaviera(nombre?: string, tipo?: number): { nombre: string; color: string; icono: string } | null {
    if (!nombre) return null;
    const n = nombre.toUpperCase();

    if (n.includes('BALEARIA') || n.includes('BALEÀRIA')) return { nombre: 'Baleària', color: '#00838f', icono: 'fa-ship' };
    if (n.includes('ARMAS') || n.includes('VOLCAN') || n.includes('VOLCÁN') || n.includes('CIUDAD DE')) return { nombre: 'Naviera Armas / Trasme', color: '#c2185b', icono: 'fa-ship' };
    if (n.includes('FRED OLSEN') || n.includes('BETANCOURIA') || n.includes('BAJAMAR EXPRESS')) return { nombre: 'Fred. Olsen Express', color: '#f57c00', icono: 'fa-ship' };
    if (n.includes('GRIMALDI')) return { nombre: 'Grimaldi Lines', color: '#1565c0', icono: 'fa-ship' };
    if (n.includes('GNV') || n.includes('GRANDI NAVI')) return { nombre: 'GNV Ferries', color: '#00695c', icono: 'fa-ship' };
    if (n.includes('BRITTANY')) return { nombre: 'Brittany Ferries', color: '#283593', icono: 'fa-ship' };
    if (n.includes('SALVAMAR') || n.includes('SAR ') || n.includes('CLARA CAMPOAMOR') || n.includes('DON INDA') || n.includes('LUZ DE MAR')) {
      return { nombre: 'Salvamento Marítimo', color: '#d32f2f', icono: 'fa-life-ring' };
    }
    if (n.includes('RIO ') && (n.includes('SEGURA') || n.includes('MIÑO') || n.includes('ARLANZA') || n.includes('TAGOMAGO'))) {
      return { nombre: 'Guardia Civil del Mar', color: '#2e7d32', icono: 'fa-shield-alt' };
    }
    if (n.includes('MAERSK')) return { nombre: 'Maersk Line', color: '#0288d1', icono: 'fa-box' };
    if (n.includes('CMA CGM')) return { nombre: 'CMA CGM', color: '#c62828', icono: 'fa-box' };
    if (n.includes('HAPAG')) return { nombre: 'Hapag-Lloyd', color: '#e65100', icono: 'fa-box' };
    if (n.includes('ROYAL CARIBBEAN') || n.includes('OF THE SEAS')) return { nombre: 'Royal Caribbean', color: '#1a237e', icono: 'fa-cocktail' };
    if (n.includes('COSTA ') && tipo && tipo >= 60 && tipo <= 69) return { nombre: 'Costa Cruceros', color: '#fbc02d', icono: 'fa-cocktail' };
    if (n.startsWith('MSC ') && tipo && tipo >= 60 && tipo <= 69) return { nombre: 'MSC Cruceros', color: '#0d47a1', icono: 'fa-cocktail' };
    if (n.startsWith('MSC ')) return { nombre: 'MSC Cargo', color: '#37474f', icono: 'fa-box' };

    return null;
  }

  // 2. Estimación de personas a bordo (Pasajeros + Tripulación estimada) según tipo y eslora
  estimarCapacidad(barco: any): { texto: string; detalle: string; icono: string } {
    const tipo = barco.tipo;
    const eslora = barco.eslora || 0;

    // Pasaje, Ferries y Cruceros (Turistas + Tripulación de servicio)
    if (tipo != null && tipo >= 60 && tipo <= 69) {
      if (eslora >= 280) {
        return { texto: '~4.500 - 6.500 Pasajeros', detalle: 'Megacrucero con ~1.800 tripulantes a bordo', icono: 'fa-users' };
      } else if (eslora >= 160) {
        return { texto: '~1.200 - 2.200 Pasajeros', detalle: '~120 tripulantes y bodega para ~350 vehículos', icono: 'fa-users' };
      } else if (eslora >= 80) {
        return { texto: '~500 - 900 Pasajeros', detalle: 'Fast Ferry con ~35 tripulantes y ~150 coches', icono: 'fa-users' };
      } else {
        return { texto: '~150 - 350 Pasajeros', detalle: 'Línea de pasaje con ~15 tripulantes', icono: 'fa-users' };
      }
    }

    // Cargueros y Mercantes
    if (tipo != null && tipo >= 70 && tipo <= 79) {
      return { 
        texto: '~18 - 26 Tripulantes a bordo', 
        detalle: eslora >= 300 ? 'Megabuque mercante (oficiales, máquinas y marinería)' : 'Carguero comercial en ruta marítima', 
        icono: 'fa-user-friends' 
      };
    }

    // Petroleros y Quimiqueros
    if (tipo != null && tipo >= 80 && tipo <= 89) {
      return { 
        texto: '~20 - 28 Tripulantes a bordo', 
        detalle: 'Buque tanque cisterna (seguridad especial y máquinas)', 
        icono: 'fa-user-friends' 
      };
    }

    // Pesqueros
    if (tipo === 30) {
      return { 
        texto: eslora > 35 ? '~12 - 20 Pescadores' : '~4 - 8 Marineros', 
        detalle: 'Tripulación dedicada a la pesca en faena', 
        icono: 'fa-fish' 
      };
    }

    // Remolcadores
    if (tipo === 31 || tipo === 32) {
      return { 
        texto: '~4 - 8 Tripulantes', 
        detalle: 'Personal técnico de maniobra y remolque portuario', 
        icono: 'fa-user-friends' 
      };
    }

    // Recreo / Yate / Velero
    if (tipo === 36 || tipo === 37) {
      return { 
        texto: eslora > 30 ? 'Superyate (~8 - 15 tripulantes + invitados)' : '~2 - 6 Personas a bordo', 
        detalle: 'Embarcación deportiva y de ocio', 
        icono: 'fa-user' 
      };
    }

    // Por defecto para cualquier buque comercial en navegación
    return { 
      texto: '~12 - 20 Tripulantes estimados', 
      detalle: 'Dotación habitual de navegación en puente y máquinas', 
      icono: 'fa-user-friends' 
    };
  }

  // 3. Traductor de códigos de puerto UN/LOCODE a ciudades legibles con coordenadas
  decodificarPuerto(destinoRaw?: string): { nombre: string; pais: string; bandera: string; lat: number; lon: number } | null {
    if (!destinoRaw) return null;
    const d = destinoRaw.toUpperCase().replace(/[^A-Z0-9]/g, ' ');

    const puertos: { [key: string]: { nombre: string; pais: string; bandera: string; lat: number; lon: number } } = {
      'ESBCN': { nombre: 'Barcelona', pais: 'España', bandera: '🇪🇸', lat: 41.35, lon: 2.16 },
      'ESVLC': { nombre: 'Valencia', pais: 'España', bandera: '🇪🇸', lat: 39.45, lon: -0.32 },
      'ESALG': { nombre: 'Algeciras', pais: 'España', bandera: '🇪🇸', lat: 36.13, lon: -5.43 },
      'ESIBZ': { nombre: 'Ibiza', pais: 'España', bandera: '🇪🇸', lat: 38.91, lon: 1.44 },
      'ESPMI': { nombre: 'Palma de Mallorca', pais: 'España', bandera: '🇪🇸', lat: 39.56, lon: 2.63 },
      'ESMAH': { nombre: 'Mahón (Menorca)', pais: 'España', bandera: '🇪🇸', lat: 39.89, lon: 4.27 },
      'ESALC': { nombre: 'Alicante', pais: 'España', bandera: '🇪🇸', lat: 38.33, lon: -0.48 },
      'ESBIO': { nombre: 'Bilbao', pais: 'España', bandera: '🇪🇸', lat: 43.35, lon: -3.05 },
      'ESVGO': { nombre: 'Vigo', pais: 'España', bandera: '🇪🇸', lat: 42.24, lon: -8.73 },
      'ESLPA': { nombre: 'Las Palmas (G.C.)', pais: 'España', bandera: '🇪🇸', lat: 28.14, lon: -15.42 },
      'ESTCI': { nombre: 'S.C. de Tenerife', pais: 'España', bandera: '🇪🇸', lat: 28.47, lon: -16.24 },
      'ESCEU': { nombre: 'Ceuta', pais: 'España', bandera: '🇪🇸', lat: 35.89, lon: -5.31 },
      'ESMLN': { nombre: 'Melilla', pais: 'España', bandera: '🇪🇸', lat: 35.29, lon: -2.93 },
      'ESCAG': { nombre: 'Cádiz', pais: 'España', bandera: '🇪🇸', lat: 36.53, lon: -6.28 },
      'MAPTM': { nombre: 'Tánger Med', pais: 'Marruecos', bandera: '🇲🇦', lat: 35.89, lon: -5.50 },
      'GIB':   { nombre: 'Gibraltar', pais: 'Gibraltar', bandera: '🇬🇮', lat: 36.14, lon: -5.35 },
      'FRMRS': { nombre: 'Marsella', pais: 'Francia', bandera: '🇫🇷', lat: 43.34, lon: 5.34 },
      'ITGOA': { nombre: 'Génova', pais: 'Italia', bandera: '🇮🇹', lat: 44.40, lon: 8.92 }
    };

    for (const [code, info] of Object.entries(puertos)) {
      if (d.includes(code) || d.includes(info.nombre.toUpperCase())) {
        return info;
      }
    }

    return null;
  }

  // 4. Calcula distancia restante en millas náuticas y progreso hacia el puerto
  calcularProgresoNautico(barco: any, puerto: any): { distanciaMN: number; tiempoRestante: string; porcentaje: number } | null {
    if (!puerto || barco.latitud == null || barco.longitud == null) return null;

    // Fórmula Haversine para distancia náutica
    const R = 3440.065; // Radio de la Tierra en millas náuticas
    const dLat = (puerto.lat - barco.latitud) * Math.PI / 180;
    const dLon = (puerto.lon - barco.longitud) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(barco.latitud * Math.PI / 180) * Math.cos(puerto.lat * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanciaMN = Math.round(R * c);

    let tiempoRestante = 'Calculando...';
    let porcentaje = 50;

    if (distanciaMN < 2) {
      tiempoRestante = 'Atracando en puerto';
      porcentaje = 96;
    } else if (barco.velocidad && barco.velocidad > 1.5) {
      const horas = distanciaMN / barco.velocidad;
      if (horas < 1) {
        tiempoRestante = `En ~${Math.round(horas * 60)} min`;
      } else {
        const h = Math.floor(horas);
        const m = Math.round((horas - h) * 60);
        tiempoRestante = `En ~${h}h ${m > 0 ? m + 'm' : ''}`;
      }
      porcentaje = Math.min(92, Math.max(10, Math.round(100 - (distanciaMN / 2))));
    } else {
      tiempoRestante = `${distanciaMN} NM al puerto`;
    }

    return { distanciaMN, tiempoRestante, porcentaje };
  }


  centrarEnBarco(barco: any): void {
    if (barco && barco.latitud != null && barco.longitud != null && this.map) {
      this.seleccionarBarco(barco);
      this.map.setView([barco.latitud, barco.longitud], Math.max(this.map.getZoom(), 9));
    }
  }

  alternarTabla(): void {
    this.mostrarTabla = !this.mostrarTabla;
  }

  // Lista filtrada reactiva para la tabla flotante
  get barcosFiltrados(): any[] {
    if (!this.filtroBarco) return this.barcos;
    const q = this.filtroBarco.toLowerCase().trim();
    return this.barcos.filter(b =>
      (b.nombre && b.nombre.toLowerCase().includes(q)) ||
      (b.mmsi && b.mmsi.toLowerCase().includes(q)) ||
      (b.pais && b.pais.toLowerCase().includes(q)) ||
      (b.destino && b.destino.toLowerCase().includes(q)) ||
      (b.tipoDescripcion && b.tipoDescripcion.toLowerCase().includes(q))
    );
  }

}


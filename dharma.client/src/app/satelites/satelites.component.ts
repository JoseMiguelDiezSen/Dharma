// Importa Component, OnInit, AfterViewInit y OnDestroy desde el núcleo de Angular
import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
// Importa HttpClient para peticiones HTTP al backend
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';

// Decorador que configura el componente
@Component({
    selector: 'app-satelites',
    templateUrl: './satelites.component.html',
    styleUrls: ['./satelites.component.css'],
    standalone: false
})
export class SatelitesComponent implements OnInit, AfterViewInit, OnDestroy {

  // Título de la pantalla
  titulo: string = 'Tracking de Satélites en Tiempo Real';

  // Telemetría del satélite actualmente monitoreado
  sateliteActual: any = null;

  // Catálogo de satélites destacados para selección rápida
  satelitesDestacados: any[] = [];

  // ID NORAD seleccionado (por defecto 0 para Todos)
  noradIdSeleccionado: number = 0;
  // Modo que visualiza todos los satélites a la vez en el globo 3D (activado por defecto)
  modoTodos: boolean = true;

  // Indicador de carga de telemetría y del motor 3D
  cargando: boolean = false;
  cargando3D: boolean = false;

  // Mensaje de error si falla la comunicación
  errorMsg: string = '';

  // Control de refresco automático
  autoRefresco: boolean = true;
  private intervaloRefresco: any = null;

  // Búsqueda manual de código NORAD
  noradManual: string = '';

  // Referencias a Cesium 3D
  private cesiumModule: any = null;
  private cesiumViewer: any = null;
  private cesiumCargado: boolean = false;
  private entitySatelite: any = null;
  private entityTrayectoria: any = null;
  private posicionesCartesianas3D: any[] = [];
  private entitiesSatelitesMap: Map<number, any> = new Map();

  // Constructor con inyección de HttpClient
  constructor(private http: HttpClient) { }

  // Se ejecuta al inicializar el componente
  ngOnInit(): void {
    this.cargarDestacados();
  }

  // Se ejecuta tras renderizar la vista
  async ngAfterViewInit(): Promise<void> {
    await this.iniciarCesium();
    this.obtenerTelemetria(true);
    this.iniciarAutoRefresco();
  }

  // Limpieza al abandonar la pantalla
  ngOnDestroy(): void {
    if (this.intervaloRefresco) {
      clearInterval(this.intervaloRefresco);
      this.intervaloRefresco = null;
    }
    if (this.cesiumViewer && !this.cesiumViewer.isDestroyed()) {
      this.cesiumViewer.destroy();
      this.cesiumViewer = null;
    }
  }

  // Carga los satélites recomendados desde el backend
  cargarDestacados(): void {
    this.http.get<any[]>('/api/Satelites/destacados')
      .subscribe({
        next: (data) => {
          this.satelitesDestacados = data;
          if (this.modoTodos && this.cesiumCargado) {
            this.obtenerTelemetria(false);
          }
        },
        error: (err) => {
          console.error('Error al cargar satélites destacados:', err);
        }
      });
  }

  // Carga el script de Cesium y configura el globo 3D
  private async iniciarCesium(): Promise<void> {
    this.cargando3D = true;
    try {
      (window as any).CESIUM_BASE_URL = '/assets/cesium/';
      await this.cargarScriptCesium();
      this.cesiumModule = (window as any).Cesium;
      this.cesiumCargado = true;
      this.inicializarViewerCesium();
    } catch (error) {
      console.error('Error al cargar Cesium 3D:', error);
      this.errorMsg = 'No se pudo iniciar el motor 3D de Cesium.';
    } finally {
      this.cargando3D = false;
    }
  }

  // Configura el visor Cesium con estética espacial oscura
  private inicializarViewerCesium(): void {
    const Cesium = this.cesiumModule;
    Cesium.Ion.defaultAccessToken = '';

    this.cesiumViewer = new Cesium.Viewer('cesium-satelites', {
      baseLayer: false,
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

    // Capa base de satélite / mapa oscuro Esri
    const imageryProvider = new Cesium.UrlTemplateImageryProvider({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      maximumLevel: 16,
      credit: 'Esri &copy; NASA'
    });
    this.cesiumViewer.imageryLayers.removeAll();
    this.cesiumViewer.imageryLayers.addImageryProvider(imageryProvider);

    // Fondo espacial
    this.cesiumViewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#050811');
    this.cesiumViewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#050811');

    // Vista inicial centrada del globo terráqueo en la pantalla
    this.cesiumViewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(0, 15, 22000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0
      }
    });

    // Permite hacer clic en cualquier satélite en el globo 3D para ver su telemetría
    const handler = new Cesium.ScreenSpaceEventHandler(this.cesiumViewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const pickedObject = this.cesiumViewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.sateliteData) {
        this.sateliteActual = pickedObject.id.sateliteData;
        this.noradIdSeleccionado = pickedObject.id.sateliteData.noradId;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  // Obtiene la telemetría en tiempo real (individual o de todos los satélites)
  obtenerTelemetria(centrarCamara: boolean = false): void {
    this.cargando = true;
    this.errorMsg = '';

    if (this.modoTodos) {
      if (!this.satelitesDestacados || this.satelitesDestacados.length === 0) {
        this.cargando = false;
        return;
      }
      const peticiones = this.satelitesDestacados.map(s =>
        this.http.get<any>(`/api/Satelites?noradId=${s.noradId}`)
      );
      forkJoin(peticiones).subscribe({
        next: (satelites) => {
          this.cargando = false;
          satelites.forEach((sat) => {
            const satEnriquecido = this.enriquecerSatelite(sat);
            this.actualizarSateliteIndividualEnCesium(satEnriquecido);
            // Solo actualiza la tarjeta si el usuario ya ha pinchado en este satélite
            if (this.sateliteActual && this.sateliteActual.noradId === satEnriquecido.noradId) {
              this.sateliteActual = satEnriquecido;
            }
          });
          if (centrarCamara) {
            this.centrarVistaGlobal();
          }
        },
        error: (err) => {
          this.cargando = false;
          this.errorMsg = 'Error al actualizar la constelación de satélites.';
          console.error(err);
        }
      });
    } else {
      this.http.get<any>(`/api/Satelites?noradId=${this.noradIdSeleccionado}`)
        .subscribe({
          next: (satelite) => {
            this.sateliteActual = this.enriquecerSatelite(satelite);
            this.cargando = false;
            this.actualizarSateliteEnCesium(this.sateliteActual, centrarCamara);
          },
          error: (err) => {
            this.cargando = false;
            this.errorMsg = err.error?.mensaje || 'No se pudo conectar con el satélite.';
            console.error('Error al obtener telemetría satelital:', err);
          }
        });
    }
  }

  // Asocia fotografías oficiales, tripulación y datos clave a la tarjeta (sin emojis, solo FontAwesome)
  private enriquecerSatelite(sat: any): any {
    const metadatos: { [id: number]: { foto: string; agencia: string; anio: number; tripulacion?: string } } = {
      25544: {
        foto: '/assets/satelites/iss.jpg',
        agencia: 'NASA / Internacional',
        anio: 1998,
        tripulacion: '7 Astronautas a bordo'
      },
      48274: {
        foto: '/assets/satelites/tiangong.jpg',
        agencia: 'CNSA (China)',
        anio: 2021,
        tripulacion: '3 Taikonautas a bordo'
      },
      20580: {
        foto: '/assets/satelites/hubble.jpg',
        agencia: 'NASA / ESA',
        anio: 1990
      },
      25994: {
        foto: '/assets/satelites/terra.png',
        agencia: 'NASA (EE.UU.)',
        anio: 1999
      },
      33591: {
        foto: '/assets/satelites/noaa19.jpg',
        agencia: 'NOAA / NASA',
        anio: 2009
      },
      27386: {
        foto: '/assets/satelites/envisat.jpg',
        agencia: 'ESA (Europa)',
        anio: 2002
      }
    };

    const meta = metadatos[sat.noradId];
    if (meta) {
      sat.foto = meta.foto || sat.foto;
      sat.agencia = sat.agencia || meta.agencia;
      sat.anioLanzamiento = sat.anioLanzamiento || meta.anio;
      sat.tripulacion = sat.tripulacion || meta.tripulacion;
    }
    return sat;
  }

  // Sitúa y actualiza la entidad del satélite en el espacio 3D
  private actualizarSateliteEnCesium(satelite: any, centrarCamara: boolean = false): void {
    if (!this.cesiumViewer || !this.cesiumModule) return;
    const Cesium = this.cesiumModule;

    const altitudMetros = (satelite.altitudKm || 420) * 1000;
    const posicion3D = Cesium.Cartesian3.fromDegrees(satelite.longitud, satelite.latitud, altitudMetros);
    const svgIcon = this.generarSvgSateliteCesium();

    // Guardar punto para la trayectoria orbital
    this.posicionesCartesianas3D.push(posicion3D);
    if (this.posicionesCartesianas3D.length > 150) {
      this.posicionesCartesianas3D.shift();
    }

    // Actualizar o crear la trayectoria 3D
    if (this.entityTrayectoria) {
      this.entityTrayectoria.polyline.positions = this.posicionesCartesianas3D;
    } else {
      this.entityTrayectoria = this.cesiumViewer.entities.add({
        name: 'Órbita Satelital',
        polyline: {
          positions: this.posicionesCartesianas3D,
          width: 3,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Cesium.Color.fromCssColorString('#00e5ff')
          })
        }
      });
    }

    // Actualizar o crear el satélite en 3D
    if (this.entitySatelite) {
      this.entitySatelite.position = posicion3D;
      if (this.entitySatelite.label) {
        this.entitySatelite.label.text = `${satelite.nombre}\n${(satelite.altitudKm || 420).toFixed(0)} km`;
      }
    } else {
      this.entitySatelite = this.cesiumViewer.entities.add({
        id: 'satelite-entidad-3d',
        name: satelite.nombre,
        position: posicion3D,
        billboard: {
          image: svgIcon,
          width: 38,
          height: 38,
          scaleByDistance: new Cesium.NearFarScalar(1.0e5, 1.4, 2.5e7, 0.7)
        },
        label: {
          text: `${satelite.nombre}\n${(satelite.altitudKm || 420).toFixed(0)} km`,
          font: '12px monospace',
          fillColor: Cesium.Color.fromCssColorString('#00e5ff'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -32),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 3.5e7)
        }
      });
    }

    if (centrarCamara) {
      this.centrarEnSatelite();
    }
  }

  // Genera el gráfico SVG del satélite para Cesium 3D
  private generarSvgSateliteCesium(): string {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
        <circle cx="20" cy="20" r="16" fill="rgba(0, 229, 255, 0.2)" stroke="#00e5ff" stroke-width="2"/>
        <circle cx="20" cy="20" r="6" fill="#00e5ff"/>
        <line x1="8" y1="20" x2="32" y2="20" stroke="#00e5ff" stroke-width="2"/>
        <line x1="20" y1="8" x2="20" y2="32" stroke="#00e5ff" stroke-width="2"/>
      </svg>
    `;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // Centra y hace zoom cercano con perspectiva 3D sobre el satélite (igual que en Aviones)
  centrarEnSatelite(): void {
    if (!this.cesiumViewer || !this.cesiumModule || !this.sateliteActual) return;
    const Cesium = this.cesiumModule;
    const altitudMetros = (this.sateliteActual.altitudKm || 420) * 1000;

    this.cesiumViewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        this.sateliteActual.longitud,
        this.sateliteActual.latitud - 4.5,
        altitudMetros + 900000
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0
      },
      duration: 1.5
    });
  }

  // Sitúa o actualiza un satélite individual en el visor 3D para la vista global
  private actualizarSateliteIndividualEnCesium(satelite: any): void {
    if (!this.cesiumViewer || !this.cesiumModule) return;
    const Cesium = this.cesiumModule;

    const altitudMetros = (satelite.altitudKm || 420) * 1000;
    const posicion3D = Cesium.Cartesian3.fromDegrees(satelite.longitud, satelite.latitud, altitudMetros);
    const svgIcon = this.generarSvgSateliteCesium();

    let entity = this.entitiesSatelitesMap.get(satelite.noradId);
    if (entity) {
      entity.position = posicion3D;
      entity.sateliteData = satelite;
      if (entity.label) {
        entity.label.text = `${satelite.nombre}\n${(satelite.altitudKm || 420).toFixed(0)} km`;
      }
    } else {
      entity = this.cesiumViewer.entities.add({
        id: 'satelite-entidad-' + satelite.noradId,
        noradId: satelite.noradId,
        sateliteData: satelite,
        name: satelite.nombre,
        position: posicion3D,
        billboard: {
          image: svgIcon,
          width: 34,
          height: 34,
          scaleByDistance: new Cesium.NearFarScalar(1.0e5, 1.3, 2.5e7, 0.6)
        },
        label: {
          text: `${satelite.nombre}\n${(satelite.altitudKm || 420).toFixed(0)} km`,
          font: '11px monospace',
          fillColor: Cesium.Color.fromCssColorString('#00e5ff'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -28),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 4.0e7)
        }
      });
      this.entitiesSatelitesMap.set(satelite.noradId, entity);
    }
  }

  // Vista global centrada de la Tierra para observar todos los satélites en órbita
  centrarVistaGlobal(): void {
    if (!this.cesiumViewer || !this.cesiumModule) return;
    const Cesium = this.cesiumModule;
    this.cesiumViewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(0, 15, 24000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0
      },
      duration: 1.5
    });
  }

  // Activa la visualización de todos los satélites a la vez y oculta la tarjeta
  seleccionarModoTodos(): void {
    this.modoTodos = true;
    this.noradIdSeleccionado = 0;
    this.sateliteActual = null;
    this.posicionesCartesianas3D = [];
    if (this.entityTrayectoria) {
      this.entityTrayectoria.polyline.positions = [];
    }
    if (this.entitySatelite) {
      this.cesiumViewer.entities.remove(this.entitySatelite);
      this.entitySatelite = null;
    }
    this.obtenerTelemetria(false);
    this.centrarVistaGlobal();
  }

  // Cierra la tarjeta flotante de telemetría (igual que en Aviones)
  cerrarDetalle(): void {
    this.sateliteActual = null;
  }

  // Cambia el satélite monitoreado
  seleccionarSatelite(noradId: number): void {
    if (+noradId === 0) {
      this.seleccionarModoTodos();
      return;
    }
    this.modoTodos = false;
    if (this.noradIdSeleccionado === noradId) return;

    this.noradIdSeleccionado = noradId;
    this.limpiarEntidadesModoTodos(noradId);
    this.posicionesCartesianas3D = [];
    if (this.entityTrayectoria) {
      this.entityTrayectoria.polyline.positions = [];
    }
    this.obtenerTelemetria(true);
  }

  // Limpia entidades adicionales de Cesium al salir del modo todos
  private limpiarEntidadesModoTodos(conservarNoradId: number): void {
    if (!this.cesiumViewer) return;
    this.entitiesSatelitesMap.forEach((entity, id) => {
      if (id !== conservarNoradId) {
        this.cesiumViewer.entities.remove(entity);
        this.entitiesSatelitesMap.delete(id);
      }
    });
  }

  // Búsqueda manual de código NORAD
  buscarNoradManual(): void {
    const id = parseInt(this.noradManual.trim(), 10);
    if (!isNaN(id) && id > 0) {
      this.seleccionarSatelite(id);
      this.noradManual = '';
    }
  }

  // Pausa o reanuda el refresco continuo
  alternarAutoRefresco(): void {
    this.autoRefresco = !this.autoRefresco;
    if (this.autoRefresco) {
      this.iniciarAutoRefresco();
    } else if (this.intervaloRefresco) {
      clearInterval(this.intervaloRefresco);
      this.intervaloRefresco = null;
    }
  }

  // Timer de sondeo cada 3 segundos
  private iniciarAutoRefresco(): void {
    if (this.intervaloRefresco) {
      clearInterval(this.intervaloRefresco);
    }
    this.intervaloRefresco = setInterval(() => {
      if (this.autoRefresco) {
        this.obtenerTelemetria(false);
      }
    }, 3000);
  }

  // Carga dinámica del script oficial de Cesium
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

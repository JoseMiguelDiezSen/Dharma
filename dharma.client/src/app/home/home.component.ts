import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { retry } from 'rxjs';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
    standalone: false
})

export class HomeComponent implements OnInit, OnDestroy {
  // Rutas imagenes
  readonly imageLogo = "../../assets/imageButton.svg";
  jsmIcon = "../../assets/JMDCorto-optimizado.png";

  // Reloj militar Zulu (UTC) y hora local
  horaUtc: string = '--:--:-- ZULU';
  horaLocal: string = '--:--:--';
  fechaUtc: string = '';
  private timerReloj: any = null;

  // Métricas y telemetría en vivo del Centro de Mando
  cargandoMetricas: boolean = true;
  sateliteIss: any = null;
  totalAviones: number | null = null;
  totalBarcos: number | null = null;
  totalUsuarios: number | null = null;

  // Estado operacional de subsistemas
  estadoSistemas = {
    espacio: 'ONLINE',
    aire: 'ONLINE',
    mar: 'ONLINE',
    seguridad: 'ONLINE'
  };

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.actualizarReloj();
    this.timerReloj = setInterval(() => this.actualizarReloj(), 1000);
    this.cargarMetricasEnVivo();
  }

  ngOnDestroy(): void {
    if (this.timerReloj) {
      clearInterval(this.timerReloj);
    }
  }

  // Actualiza el reloj militar sincronizado en UTC (Zulu)
  private actualizarReloj(): void {
    const ahora = new Date();
    this.horaUtc = ahora.toISOString().substring(11, 19) + ' ZULU';
    this.horaLocal = ahora.toTimeString().substring(0, 8);
    this.fechaUtc = ahora.toISOString().substring(0, 10);
  }

  // Carga asíncrona de datos en vivo de los 4 vectores con auto-reintento
  public cargarMetricasEnVivo(): void {
    this.cargandoMetricas = true;

    // 1. Telemetría ISS (Estación Espacial Internacional)
    this.http.get('/api/Satelites?noradId=25544')
      .pipe(retry({ count: 5, delay: 1500 }))
      .subscribe({
        next: (data: any) => {
          this.sateliteIss = data;
          this.estadoSistemas.espacio = 'ONLINE';
        },
        error: () => {
          this.estadoSistemas.espacio = 'DEGRADED';
        }
      });

    // 2. Conteo de aviones en espacio aéreo
    this.http.get<any[]>('/api/Aviones')
      .pipe(retry({ count: 5, delay: 1500 }))
      .subscribe({
        next: (aviones) => {
          this.totalAviones = Array.isArray(aviones) ? aviones.length : 0;
          this.estadoSistemas.aire = 'ONLINE';
        },
        error: () => {
          this.estadoSistemas.aire = 'STANDBY';
        }
      });

    // 3. Conteo de barcos en aguas monitorizadas
    this.http.get<any[]>('/api/Barcos')
      .pipe(retry({ count: 5, delay: 1500 }))
      .subscribe({
        next: (barcos) => {
          this.totalBarcos = Array.isArray(barcos) ? barcos.length : 0;
          this.estadoSistemas.mar = 'ONLINE';
        },
        error: () => {
          this.estadoSistemas.mar = 'STANDBY';
        }
      });

    // 4. Conteo de operadores autorizados
    this.http.get<any[]>('/api/Usuarios')
      .pipe(retry({ count: 5, delay: 1500 }))
      .subscribe({
        next: (usuarios) => {
          this.totalUsuarios = Array.isArray(usuarios) ? usuarios.length : 0;
          this.estadoSistemas.seguridad = 'ONLINE';
          this.cargandoMetricas = false;
        },
        error: () => {
          this.estadoSistemas.seguridad = 'STANDBY';
          this.cargandoMetricas = false;
        }
      });
  }
}

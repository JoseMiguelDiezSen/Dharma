// Importa Component y OnInit desde el núcleo de Angular
import { Component, OnInit } from '@angular/core';
// Importa HttpClient para futuras peticiones HTTP al backend
import { HttpClient } from '@angular/common/http';

// Decorador que configura el componente
@Component({
  // Selector oficial con prefijo app-
  selector: 'app-aviones',
  // Archivo HTML con la vista
  templateUrl: './aviones.component.html',
  // Archivo CSS con los estilos del componente
  styleUrls: ['./aviones.component.css']
})
export class AvionesComponent implements OnInit {

  // Título de la pantalla
  titulo: string = 'Vuelos en Tiempo Real (OpenSky)';

  // Lista de aviones devueltos por el backend
  aviones: any[] = [];

  // Indicador de carga
  cargando: boolean = false;

  // Constructor con inyección de HttpClient
  constructor(private http: HttpClient) { }

  // Se ejecuta al cargar el componente
  ngOnInit(): void {
    this.obtenerAviones();
  }

  // Llama a la API para obtener los aviones en tiempo real
  obtenerAviones(): void {
    this.cargando = true;
    this.http.get<any[]>('/api/Aviones')
      .subscribe({
        next: (data) => {
          this.aviones = data;
          this.cargando = false;
        },
        error: (err) => {
          console.error('Error al obtener aviones de OpenSky:', err);
          this.cargando = false;
        }
      });
  }

}

// Importa Component y OnInit desde el núcleo de Angular
import { Component, OnInit } from '@angular/core';
// Importa HttpClient para futuras peticiones HTTP al backend
import { HttpClient } from '@angular/common/http';

// Decorador que configura el componente
@Component({
  // Selector oficial con prefijo app-
  selector: 'app-barcos',
  // Archivo HTML con la vista
  templateUrl: './barcos.component.html',
  // Archivo CSS con los estilos del componente
  styleUrls: ['./barcos.component.css']
})
export class BarcosComponent implements OnInit {

  // Título de la pantalla
  titulo: string = 'Gestión de Barcos';

  // Constructor con inyección de HttpClient
  constructor(private http: HttpClient) { }

  // Se ejecuta al cargar el componente
  ngOnInit(): void {
    console.log('Componente Barcos cargado');
  }

}

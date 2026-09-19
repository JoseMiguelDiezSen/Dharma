// Importamos Component, Input, Output, EventEmitter y OnChanges desde el núcleo de Angular
import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
// Importamos HttpClient para poder realizar peticiones HTTP al API
import { HttpClient } from '@angular/common/http';




// Decorador: Define la configuración del componente
@Component({
  // Nombre de la etiqueta HTML que representa este componente
  selector: 'app-anadir-usuario',

  // Archivo HTML que contiene la vista del componente
  templateUrl: './agregar-usuario.component.html',

// Archivo CSS que contiene los estilos del componente
  styleUrls: ['./agregar-usuario.component.css']
})




// Clase del componente para agregar usuarios
export class AnadirUsuarioComponent implements OnChanges {

  // Recibe desde el componente padre el valor de modalAgregarUsuario
  @Input() abrir: boolean = false;

  // Controla si el modal de agregar usuario está visible
  modalAgregarUsuario: boolean = false;

  // Datos del usuario que estamos creando
  usuario: any = {};


  // Controla si mostramos la contraseña
  mostrarPassword: boolean = false;

  // Constructor
  constructor(private http: HttpClient) {
  }

  // Se ejecuta cuando cambia el valor recibido mediante @Input
  ngOnChanges(): void {

    // Copiamos el valor recibido del padre a la variable que utiliza el modal
    this.modalAgregarUsuario = this.abrir;
  }

  // @Output(): emisor de eventos para avisar al componente padre
  @Output() cerrar = new EventEmitter<void>();

  // Método que oculta el modal y emite el evento al padre
  cerrarModal(): void {
    // 1. Oculta el modal en este componente
    this.modalAgregarUsuario = false;

    // 2. Notifica al componente padre para que ponga su variable a false
    this.cerrar.emit();
  }

  // Avisa al componente padre cuando se crea el usuario
  @Output() usuarioAgregado = new EventEmitter<void>();

  // Añade el nuevo usuario enviándolo a la API
  addUser(): void {
    // Asigna la fecha y hora actual ya que el formulario no la pide
    this.usuario.fechaAlta = new Date();
    // Convierte el texto del input a número para coincidir con el int de C#
    this.usuario.telefono = Number(this.usuario.telefono);
    // Envía el usuario por POST a la API; .subscribe() ejecuta la petición y espera respuesta
    this.http.post('/api/Usuarios', this.usuario).subscribe(() => {

      // Avisa al padre para refrescar la tabla
      this.usuarioAgregado.emit();

      // Limpia el formulario
      this.usuario = {};

      // Cierra la ventana modal
      this.cerrarModal();          
    });
  }
}


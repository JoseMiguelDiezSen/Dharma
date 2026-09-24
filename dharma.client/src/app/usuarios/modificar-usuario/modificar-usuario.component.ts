// Importamos Component, Input, Output, EventEmitter y OnChanges desde el núcleo de Angular
import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
// Importamos HttpClient para comunicarnos con la API backend
import { HttpClient } from '@angular/common/http';

@Component({
    selector: 'app-modificar-usuario',
    templateUrl: './modificar-usuario.component.html',
    styleUrls: ['./modificar-usuario.component.css'],
    standalone: false
})
export class ModificarUsuarioComponent implements OnChanges {

  // Recibe la orden del componente padre para mostrar u ocultar el modal
  @Input() abrir: boolean = false;

  // Recibe los datos del usuario que se quiere modificar desde la fila de la tabla
  @Input() usuario: any = null;

  // Controla la visibilidad del modal en este componente
  modalModificarUsuario: boolean = false;

  // Controla si se visualiza u oculta la contraseña
  mostrarPassword: boolean = false;

  // Variable interna donde clonamos los datos del usuario para el formulario
  usuarioEditar: any = {};

  // Inyectamos el servicio HttpClient en el constructor
  constructor(private http: HttpClient) {
  }

  // Se ejecuta automáticamente cada vez que cambian los @Input recibidos del padre
  ngOnChanges(): void {
    // Sincronizamos el estado de apertura del modal
    this.modalModificarUsuario = this.abrir;

    // Si recibimos un usuario, creamos una copia de sus datos para cargarlos en los inputs
    if (this.usuario) {
      this.usuarioEditar = { ...this.usuario };
    }
  }

  // Emisor de eventos para avisar al componente padre cuando se cierra el modal
  @Output() cerrar = new EventEmitter<void>();

  // Emisor de eventos para avisar al padre de que el usuario ha sido modificado y refrescar la tabla
  @Output() usuarioModificado = new EventEmitter<void>();

  // Método que oculta el modal y avisa al componente padre
  cerrarModal(): void {
    // 1. Oculta el modal en este componente
    this.modalModificarUsuario = false;

    // 2. Notifica al componente padre para que ponga su variable a false
    this.cerrar.emit();
  }

  // Método que envía los datos editados al backend mediante una petición HTTP PUT
  editUser(): void {
    // Nos aseguramos de que el teléfono sea un número entero
    this.usuarioEditar.telefono = Number(this.usuarioEditar.telefono);

    // Realizamos la llamada PUT a la API enviando el ID en la URL y los datos modificados en el cuerpo
    this.http.put(`/api/Usuarios/${this.usuarioEditar.idUsuario}`, this.usuarioEditar)
      .subscribe(() => {
        // Notificamos al componente padre para que refresque la tabla
        this.usuarioModificado.emit();

        // Cerramos la ventana modal
        this.cerrarModal();
      });
  }

}


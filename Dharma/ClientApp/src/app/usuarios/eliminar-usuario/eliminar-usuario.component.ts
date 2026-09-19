// Importamos Component, Input, Output, EventEmitter y OnChanges desde el núcleo de Angular
import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
// Importamos HttpClient para realizar peticiones HTTP al backend
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-eliminar-usuario',
  templateUrl: './eliminar-usuario.component.html',
  styleUrls: ['./eliminar-usuario.component.css']
})
export class EliminarUsuarioComponent implements OnChanges {

  // Recibe la orden del componente padre para abrir o cerrar el modal
  @Input() abrir: boolean = false;

  // Recibe los datos del usuario que se pretende eliminar
  @Input() usuario: any = null;

  // Controla si el modal está visible en pantalla
  modalEliminarUsuario: boolean = false;

  // Inyectamos el servicio HttpClient en el constructor
  constructor(private http: HttpClient) {
  }

  // Se ejecuta cuando el componente padre cambia alguno de los @Input
  ngOnChanges(): void {
    this.modalEliminarUsuario = this.abrir;
  }

  // Emisor de eventos para avisar al componente padre al cerrar la ventana
  @Output() cerrar = new EventEmitter<void>();

  // Emisor de eventos para avisar al padre de que el usuario ha sido eliminado para refrescar la tabla
  @Output() usuarioEliminado = new EventEmitter<void>();

  // Método que oculta el modal y emite el evento al padre
  cerrarModal(): void {
    // 1. Oculta el modal en este componente
    this.modalEliminarUsuario = false;

    // 2. Notifica al componente padre para que ponga su variable a false
    this.cerrar.emit();
  }

  // Método que realiza la llamada DELETE a la API para borrar el usuario
  deleteUser(): void {
    if (!this.usuario || !this.usuario.idUsuario) {
      return;
    }

    // Petición HTTP DELETE a la API enviando el ID del usuario en la ruta
    this.http.delete(`/api/Usuarios/${this.usuario.idUsuario}`)
      .subscribe(() => {
        // Notificamos al componente padre que se ha eliminado correctamente
        this.usuarioEliminado.emit();

        // Cerramos la ventana modal
        this.cerrarModal();
      });
  }

}

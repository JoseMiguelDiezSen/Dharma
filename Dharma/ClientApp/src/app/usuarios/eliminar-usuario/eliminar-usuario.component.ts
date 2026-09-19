// Importamos Component, Input, Output, EventEmitter y OnChanges desde el núcleo de Angular
import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';

@Component({
  selector: 'app-eliminar-usuario',
  templateUrl: './eliminar-usuario.component.html',
  styleUrls: ['./eliminar-usuario.component.css']
})
export class EliminarUsuarioComponent implements OnChanges {

  @Input() abrir: boolean = false;

  modalEliminarUsuario: boolean = false;

  ngOnChanges(): void {
    this.modalEliminarUsuario = this.abrir;
  }

  // @Output(): emisor de eventos para avisar al componente padre
  @Output() cerrar = new EventEmitter<void>();

  // Método que oculta el modal y emite el evento al padre
  cerrarModal(): void {
    // 1. Oculta el modal en este componente
    this.modalEliminarUsuario = false;

    // 2. Notifica al componente padre para que ponga su variable a false
    this.cerrar.emit();
  }

  deleteUser(): void {
  }

}

// Importamos Component, Input, Output, EventEmitter y OnChanges desde el núcleo de Angular
import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';

@Component({
  selector: 'app-modificar-usuario',
  templateUrl: './modificar-usuario.component.html',
  styleUrls: ['./modificar-usuario.component.css']
})
export class ModificarUsuarioComponent implements OnChanges {

  @Input() abrir: boolean = false;

  modalModificarUsuario: boolean = false;
  mostrarPassword: boolean = false;

  ngOnChanges(): void {
    this.modalModificarUsuario = this.abrir;
  }

  // @Output(): emisor de eventos para avisar al componente padre
  @Output() cerrar = new EventEmitter<void>();

  // Método que oculta el modal y emite el evento al padre
  cerrarModal(): void {
    // 1. Oculta el modal en este componente
    this.modalModificarUsuario = false;

    // 2. Notifica al componente padre para que ponga su variable a false
    this.cerrar.emit();
  }

  editUser(): void {
  }

}
